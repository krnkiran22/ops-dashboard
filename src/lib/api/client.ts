/**
 * Browser-side API client for the ops portal.
 *
 * Gateway segment defaults to **v2** (`/v2/ops/...`). Only set
 * `NEXT_PUBLIC_OPS_API_GATEWAY_VERSION=v1` for legacy gateways that do not expose v2.
 *
 * **CORS / ngrok / Vercel:** Browsers block cross-origin calls to tunnels. Set
 * `NEXT_PUBLIC_OPS_SAME_ORIGIN_PROXY=true` so requests go to `/api/ops-proxy/...` on this
 * origin; the Next.js route forwards to `NEXT_PUBLIC_BACKEND_API_URL` (see
 * `src/app/api/ops-proxy/[...path]/route.ts`).
 *
 * For the Python mock on :8765, use `NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8765`,
 * `NEXT_PUBLIC_OPS_SKIP_AUTH=true`, and (on Vercel) enable the same-origin proxy.
 */

import { getAuthToken, extractApiError } from "@/lib/api/auth";
import { OpsMockHttpError, resolveMockOpsApi } from "@/lib/api/mock-responses";
import { resolveOpsGatewaySegment } from "@/lib/api/ops-gateway";

export { DEFAULT_OPS_API_GATEWAY_VERSION, resolveOpsGatewaySegment } from "@/lib/api/ops-gateway";

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
  process.env.NEXT_PUBLIC_BACKEND_API_URL?.trim() || DEFAULT_LOCAL_API_BASE_URL;

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
  return true;
}

function opsApiGatewaySegment(): string {
  return resolveOpsGatewaySegment();
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

/**
 * When enabled, the browser calls same-origin `/api/ops-proxy/...` so the Next server
 * forwards to the real API — avoids CORS on ngrok / remote gateways.
 */
function useSameOriginProxy(): boolean {
  const flag = process.env.NEXT_PUBLIC_OPS_SAME_ORIGIN_PROXY;
  if (flag === "false" || flag === "0") return false;
  if (flag === "true" || flag === "1") return true;
  return false;
}

function buildOpsRequestUrl(
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>
): URL {
  const segment = opsApiGatewaySegment();
  if (typeof window !== "undefined" && useSameOriginProxy()) {
    const rest = path.replace(/^\/ops\/?/, "").replace(/^\/+/, "");
    const u = new URL(`${window.location.origin}/api/ops-proxy/${rest}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value != null && value !== "")
          u.searchParams.set(key, String(value));
      }
    }
    return u;
  }

  const u = new URL(joinApiUrl(resolveOpsApiBaseUrl(), segment, path));
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== "")
        u.searchParams.set(key, String(value));
    }
  }
  return u;
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

  if (
    host === "localhost.ops.build.ai" ||
    host === "127.0.0.1" ||
    host === "localhost"
  ) {
    return configuredApiBaseUrl.replace(/\/+$/, "");
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
      if (e instanceof OpsMockHttpError) {
        throw new ApiError(e.message, e.status);
      }
      const msg = e instanceof Error ? e.message : "Mock API error";
      throw new ApiError(msg, 500);
    }
  }

  // --- Auth ---
  const effectiveSkipAuth = skipAuth || shouldSkipOpsAuth();
  let token = effectiveSkipAuth ? null : await getAuthToken();

  const url = buildOpsRequestUrl(path, params);

  // --- Headers (ngrok bypass only when calling the tunnel URL directly from the browser) ---
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

/**
 * `GET /health` on the API host (not under `/v1/ops` or `/v2/ops`).
 * Use to verify the Python ops mock (`api.mock_main`) or any gateway that exposes root health.
 * When {@link shouldUseMockOpsApi} is true, returns a synthetic payload without a network call.
 */
export async function fetchOpsServerHealth(): Promise<{
  status?: string;
  server?: string;
}> {
  if (typeof window === "undefined") {
    throw new Error("fetchOpsServerHealth is only available in the browser");
  }
  if (shouldUseMockOpsApi()) {
    return { status: "ok", server: "in-app-mock" };
  }
  const useProxy =
    typeof window !== "undefined" && useSameOriginProxy();
  const url = useProxy
    ? `${window.location.origin}/api/ops-backend-health`
    : `${resolveOpsApiBaseUrl().replace(/\/+$/, "")}/health`;
  const effectiveSkipAuth = shouldSkipOpsAuth();
  let token = effectiveSkipAuth ? null : await getAuthToken();
  const headers: Record<string, string> = {
    ...ngrokBrowserWarningHeaders(url),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response = await fetch(url, { headers });
  if (response.status === 401 && !token && !effectiveSkipAuth) {
    token = await getAuthToken({ retries: 3, retryDelayMs: 100 });
    if (token) {
      response = await fetch(url, {
        headers: { ...headers, Authorization: `Bearer ${token}` },
      });
    }
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const msg = extractApiError(errorBody);
    throw new ApiError(
      msg !== "Unknown error" ? msg : `Health check failed: ${response.status}`,
      response.status,
    );
  }
  return (await response.json().catch(() => ({}))) as {
    status?: string;
    server?: string;
  };
}
