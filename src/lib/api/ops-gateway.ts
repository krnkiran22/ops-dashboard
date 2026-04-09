/**
 * Ops API path segment: `{origin}/{gateway}/ops/...` (e.g. `/v2/ops/leads`).
 * The v2 mock and current dashboard integration use **v2** by default.
 * Set `NEXT_PUBLIC_OPS_API_GATEWAY_VERSION=v1` only for legacy gateways.
 */

export const DEFAULT_OPS_API_GATEWAY_VERSION = "v2" as const;

/** Normalized gateway segment: `v1` | `v2` (defaults to v2). */
export function resolveOpsGatewaySegment(): string {
  const raw =
    process.env.NEXT_PUBLIC_OPS_API_GATEWAY_VERSION?.trim() ??
    DEFAULT_OPS_API_GATEWAY_VERSION;
  const s = raw.replace(/^\/+|\/+$/g, "");
  if (s === "v1" || s === "v2") return s;
  return DEFAULT_OPS_API_GATEWAY_VERSION;
}
