/**
 * Lead `metadata` keys for the ops pipeline (merged on PATCH in mock).
 */

export const META = {
  CS_STAFF_ID: "cs_staff_id",
  FIELD_OPS_READY: "field_ops_ready",
  FIELD_OPS_STAFF_ID: "field_ops_staff_id",
  VERIFIED_WORKER_COUNT: "verified_worker_count",
  SHIPMENT_SERVICE: "shipment_service",
  SHIPMENT_TRACKING: "shipment_tracking",
} as const;

export function metaBool(v: unknown): boolean {
  return v === true || v === "true" || v === "1";
}

export function metaString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

export function metaNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}
