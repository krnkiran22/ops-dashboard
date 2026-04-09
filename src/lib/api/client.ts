/**
 * Browser-side API client for the ops portal.
 *
 * Gateway segment defaults to `v1` (`/v1/ops/...`). For the standalone Ops mock
 * (`/v2/ops/...` on e.g. port 8765), set `NEXT_PUBLIC_OPS_API_GATEWAY_VERSION=v2`,
 * `NEXT_PUBLIC_BACKEND_API_URL`, and `NEXT_PUBLIC_OPS_SKIP_AUTH=true` — see
 * `docs/ops-v2-mock-api.md` and `.env.local.example`.
 *
 * Default API base (no env) is the team ngrok tunnel; override with
 * `NEXT_PUBLIC_BACKEND_API_URL` when the tunnel changes.
 */

import { getAuthToken, extractApiError } from "@/lib/api/auth";
import { resolveMockOpsApi } from "@/lib/api/mock-responses";

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

/** Shared ngrok tunnel for ops API (no trailing slash). Update when the tunnel rotates. */
const DEFAULT_TUNNEL_API_BASE_URL = "https://garnetlike-mara-coadunate.ngrok-free.dev";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL?.trim() || DEFAULT_TUNNEL_API_BASE_URL;

function isLikelyLocalDevHostname(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  if (hostname.startsWith("192.168.")) return true;
  if (hostname.startsWith("10.")) return true;
  return /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);
}

/**
 * When true, API calls return typed mock payloads instead of hitting the network.
 * - Set NEXT_PUBLIC_MOCK_OPS_API=true to force mocks (e.g. CI or demos).
 * - Set NEXT_PUBLIC_MOCK_OPS_API=false to force real API on localhost.
 * - If unset, mocks are used in development on localhost / 127.0.0.1 only when the
 *   effective backend is still the local Build AI default (not ngrok / :8765 / etc.).
 */
export function shouldUseMockOpsApi(): boolean {
  const flag = process.env.NEXT_PUBLIC_MOCK_OPS_API;
  if (flag === "false" || flag === "0") return false;
  if (flag === "true" || flag === "1") return true;
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV !== "development") return false;
  if (!isLikelyLocalDevHostname(window.location.hostname.toLowerCase())) return false;
  if (process.env.NEXT_PUBLIC_BACKEND_API_URL?.trim()) return false;
  if (API_BASE_URL !== DEFAULT_LOCAL_API_BASE_URL) return false;
  return true;
}

/**
 * Path segment before `/ops/...`: production uses `v1`; the standalone Ops mock
 * server uses `v2` (see `docs/ops-v2-mock-api.md`).
 */
function opsApiGatewaySegment(): string {
  const raw = process.env.NEXT_PUBLIC_OPS_API_GATEWAY_VERSION?.trim() ?? "v1";
  const s = raw.replace(/^\/+|\/+$/g, "");
  return s.length > 0 ? s : "v1";
}

/** When true, no `Authorization` header is sent (required for the no-auth mock). */
function shouldSkipOpsAuth(): boolean {
  const v = process.env.NEXT_PUBLIC_OPS_SKIP_AUTH;
  return v === "true" || v === "1";
}

function joinApiUrl(base: string, segment: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}/${segment}${p}`;
}

/** Ngrok free tier interstitial bypass for browser `fetch`. */
function ngrokBrowserWarningHeaders(requestUrl: string): Record<string, string> {
  try {
    const host = new URL(requestUrl).hostname.toLowerCase();
    if (
      host.endsWith(".ngrok-free.dev") ||
      host.endsWith(".ngrok-free.app") ||
      host.endsWith(".ngrok.io")
    ) {
      return { "ngrok-skip-browser-warning": "true" };
    }
  } catch {
    /* ignore */
  }
  return {};
}

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
      const urlObj = new URL(joinApiUrl(resolveOpsApiBaseUrl(), opsApiGatewaySegment(), path));
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
  const effectiveSkipAuth = skipAuth || shouldSkipOpsAuth();
  let token = effectiveSkipAuth ? null : await getAuthToken();

  // --- URL ---
  const url = new URL(joinApiUrl(resolveOpsApiBaseUrl(), opsApiGatewaySegment(), path));
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== "")
        url.searchParams.set(key, String(value));
    }
  }

  // --- Headers (after URL so ngrok bypass applies to final host) ---
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...ngrokBrowserWarningHeaders(url.toString()),
    ...(extraHeaders ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // --- Fetch ---
  const fetchOptions: RequestInit = {
    method,
    headers,
    ...(body != null ? { body: JSON.stringify(body) } : {}),
    ...(signal ? { signal } : {}),
  };

  let response = await fetch(url.toString(), fetchOptions);

  // Retry once if 401 and we had no token yet (Clerk race)
  if (response.status === 401 && !token && !effectiveSkipAuth) {
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
