/**
 * Browser-side API client for the ops portal.
 *
 * Mirrors the dashboard's api-client pattern but without access-boundary
 * or partner-host logic — ops always talks to one backend.
 */

import { getAuthToken, extractApiError } from "@/lib/api/auth";
import { resolveMockOpsApi } from "@/lib/api/mock-responses";

/**
 * When true, API calls return typed mock payloads instead of hitting the network.
 * - Set NEXT_PUBLIC_MOCK_OPS_API=true to force mocks (e.g. CI or demos).
 * - Set NEXT_PUBLIC_MOCK_OPS_API=false to force real API on localhost.
 * - If unset, mocks are used in development on localhost / 127.0.0.1 only.
 */
function isLikelyLocalDevHostname(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  if (hostname.startsWith("192.168.")) return true;
  if (hostname.startsWith("10.")) return true;
  return /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);
}

export function shouldUseMockOpsApi(): boolean {
  const flag = process.env.NEXT_PUBLIC_MOCK_OPS_API;
  if (flag === "false" || flag === "0") return false;
  if (flag === "true" || flag === "1") return true;
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV !== "development") return false;
  return isLikelyLocalDevHostname(window.location.hostname.toLowerCase());
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ---------------------------------------------------------------------------
// Envelope normalisation
// ---------------------------------------------------------------------------

/**
 * Unwrap the standard API envelope so callers receive the inner data
 * or a list payload with items/total/has_more fields.
 */
export function normalizeEnvelopePayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  const record = payload as Record<string, unknown>;
  const data = record.data;
  const pagination = record.pagination;

  if (Array.isArray(data) && pagination && typeof pagination === "object") {
    const p = pagination as Record<string, unknown>;
    return {
      ...record,
      items: data,
      total:
        typeof p.total_estimate === "number" ? p.total_estimate : data.length,
      has_more: Boolean(p.has_more),
      page_size: typeof p.page_size === "number" ? p.page_size : data.length,
      next_cursor: (p.next_cursor as string) ?? null,
    };
  }

  if (data !== undefined) return data;
  return payload;
}

// ---------------------------------------------------------------------------
// Core fetch
// ---------------------------------------------------------------------------

const DEFAULT_LOCAL_API_BASE_URL = "https://localhost.api.build.ai:8000";
const DEFAULT_STAGING_API_BASE_URL = "https://staging.api.build.ai";
const DEFAULT_PROD_API_BASE_URL = "https://api.build.ai";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL ||
  DEFAULT_LOCAL_API_BASE_URL;

function resolveOpsApiBaseUrl(configuredApiBaseUrl: string = API_BASE_URL): string {
  if (typeof window === "undefined") {
    return configuredApiBaseUrl;
  }

  const host = window.location.hostname.toLowerCase();
  const previewMatch = host.match(/^([a-z0-9-]+)\.preview\.ops\.build\.ai$/);
  if (previewMatch?.[1]) {
    return `https://${previewMatch[1]}.preview.api.build.ai`;
  }

  if (host === "staging.ops.build.ai") {
    return DEFAULT_STAGING_API_BASE_URL;
  }

  if (host === "ops.build.ai") {
    return DEFAULT_PROD_API_BASE_URL;
  }

  if (host === "localhost.ops.build.ai" || host === "127.0.0.1" || host === "localhost") {
    // Respect explicit env override on localhost; otherwise keep local API default.
    if (configuredApiBaseUrl !== DEFAULT_LOCAL_API_BASE_URL) {
      return configuredApiBaseUrl;
    }
    return DEFAULT_LOCAL_API_BASE_URL;
  }

  return configuredApiBaseUrl;
}

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Return the raw JSON without envelope normalisation. */
  raw?: boolean;
  /** Skip auth header (for public endpoints like claim-token resolve). */
  skipAuth?: boolean;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const {
    method = "GET",
    body,
    params,
    headers: extraHeaders,
    signal,
    raw = false,
    skipAuth = false,
  } = options;

  // --- Mock (same response shapes as production; no network) ---
  if (typeof window !== "undefined" && shouldUseMockOpsApi()) {
    try {
      const urlObj = new URL(`${resolveOpsApiBaseUrl()}/v1${path}`);
      if (params) {
        for (const [key, value] of Object.entries(params)) {
          if (value != null && value !== "")
            urlObj.searchParams.set(key, String(value));
        }
      }
      const mockPayload = resolveMockOpsApi({
        path,
        method,
        body,
        searchParams: urlObj.searchParams,
      });
      if (raw) return mockPayload as T;
      return normalizeEnvelopePayload(mockPayload) as T;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Mock API error";
      throw new ApiError(msg, 500);
    }
  }

  // --- Auth ---
  let token = skipAuth ? null : await getAuthToken();

  // --- Headers ---
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extraHeaders ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // --- URL ---
  const url = new URL(`${resolveOpsApiBaseUrl()}/v1${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== "")
        url.searchParams.set(key, String(value));
    }
  }

  // --- Fetch ---
  const fetchOptions: RequestInit = {
    method,
    headers,
    ...(body != null ? { body: JSON.stringify(body) } : {}),
    ...(signal ? { signal } : {}),
  };

  let response = await fetch(url.toString(), fetchOptions);

  // Retry once if 401 and we had no token yet (Clerk race)
  if (response.status === 401 && !token && !skipAuth) {
    token = await getAuthToken({ retries: 3, retryDelayMs: 100 });
    if (token) {
      response = await fetch(url.toString(), {
        ...fetchOptions,
        headers: { ...headers, Authorization: `Bearer ${token}` },
      });
    }
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const msg = extractApiError(errorBody);
    throw new ApiError(
      msg !== "Unknown error" ? msg : `Request failed: ${response.status}`,
      response.status
    );
  }

  const json = await response.json().catch(() => ({}));
  if (raw) return json as T;
  return normalizeEnvelopePayload(json) as T;
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

export const api = {
  get<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined | null>,
    opts?: Omit<ApiRequestOptions, "method" | "params">
  ): Promise<T> {
    return apiRequest<T>(path, { ...opts, params });
  },

  post<T>(
    path: string,
    body?: unknown,
    opts?: Omit<ApiRequestOptions, "method" | "body">
  ): Promise<T> {
    return apiRequest<T>(path, { ...opts, method: "POST", body });
  },

  patch<T>(
    path: string,
    body?: unknown,
    opts?: Omit<ApiRequestOptions, "method" | "body">
  ): Promise<T> {
    return apiRequest<T>(path, { ...opts, method: "PATCH", body });
  },

  put<T>(
    path: string,
    body?: unknown,
    opts?: Omit<ApiRequestOptions, "method" | "body">
  ): Promise<T> {
    return apiRequest<T>(path, { ...opts, method: "PUT", body });
  },

  delete<T>(
    path: string,
    opts?: Omit<ApiRequestOptions, "method">
  ): Promise<T> {
    return apiRequest<T>(path, { ...opts, method: "DELETE" });
  },
};
