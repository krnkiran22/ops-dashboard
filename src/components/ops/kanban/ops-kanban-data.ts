/**
 * Kanban pipeline types, adapters, and city coordinate fallbacks.
 *
 * The Lead/Operator/DeviceNode types are the UI-facing shapes used by
 * LeadCard and the map. The adapt* functions bridge from the API types
 * (OpsLead, OpsStaff, OpsLocation, OpsLeadAssignment) to these UI shapes.
 *
 * Status vocabulary (canonical, from ops.lead_statuses):
 *   Triage:   lead, confirmed, rejected, cancelled, deferred
 *   Pipeline: accepted, pending_visit, pending_allocation, pending_shipment,
 *             pending_deployment, deployed
 *
 * Kanban columns (v2 mock): **Sales** — lead, confirmed, rejected, cancelled, deferred
 * (rejected/cancelled hidden from board). **Customer Success** — accepted, pending_visit.
 * **Allocation** — pending_allocation. **Shipment** — pending_shipment.
 * **Deployment** — pending_deployment, deployed (live badge).
 *
 * V2 factory-centric kanban can use `GET /v2/ops/factories?pipeline_status=` per column;
 * lead-based adapters below remain the default for `OpsKanbanPage`.
 */

import type { OpsLead, OpsStaff, OpsLocation, OpsLeadAssignment } from "@/lib/api/browser-api";

// ---------------------------------------------------------------------------
// Metadata keys (PATCH replaces whole metadata — always merge client-side)
// ---------------------------------------------------------------------------

export const META_VISIT_VERIFIER_ROLE = "visit_verifier_role";
export const META_VISIT_SECONDARY_STAFF_ID = "visit_secondary_staff_id";
export const META_VISIT_SECONDARY_SCHEDULED_DATE = "visit_secondary_scheduled_date";
export const META_VISIT_SECONDARY_ROLE = "visit_secondary_role";
export const META_SHIPMENT_EXPECTED_DELIVERY = "shipment_expected_delivery_date";
export const META_SHIPMENT_CARRIER = "shipment_carrier";
export const META_SHIPMENT_TRACKING = "shipment_tracking";
export const META_SHIPMENT_LOGISTICS_NOTES = "shipment_logistics_notes";
export const META_DEPLOYMENT_CREW = "deployment_crew";

export type VisitRole = "customer_success" | "chief_operator";

export type DeploymentCrewRole = "operator" | "chief_operator";

/** Merge into existing lead.metadata before PATCH (server replaces jsonb wholesale). */
export function mergeOpsLeadMetadata(
  existing: Record<string, unknown> | undefined,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return { ...(existing ?? {}), ...patch };
}

// ---------------------------------------------------------------------------
// Canonical status enum (mirrors backend LeadStatus)
// ---------------------------------------------------------------------------

export const LeadStatus = {
  LEAD: "lead",
  CONFIRMED: "confirmed",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
  DEFERRED: "deferred",
  PENDING_VISIT: "pending_visit",
  PENDING_ALLOCATION: "pending_allocation",
  PENDING_SHIPMENT: "pending_shipment",
  PENDING_DEPLOYMENT: "pending_deployment",
  DEPLOYED: "deployed",
} as const;

export type LeadStatusValue = (typeof LeadStatus)[keyof typeof LeadStatus];

export const TRIAGE_STATUSES: Set<string> = new Set([
  LeadStatus.LEAD, LeadStatus.CONFIRMED, LeadStatus.ACCEPTED,
  LeadStatus.REJECTED, LeadStatus.CANCELLED, LeadStatus.DEFERRED,
]);

/** Hide only closed lost leads from the board; deployed stays in Deployment column. */
export const TERMINAL_STATUSES: Set<string> = new Set([
  LeadStatus.REJECTED, LeadStatus.CANCELLED,
]);

// ---------------------------------------------------------------------------
// Kanban column types
// ---------------------------------------------------------------------------

export type LeadStage =
  | "Sales"
  | "Customer Success"
  | "Allocation"
  | "Shipment"
  | "Deployment";

export type TriageBadge = "New" | "Confirmed" | "Accepted" | "Deferred" | "Rejected" | "Cancelled";

export interface DeploymentCrewMember {
  staffId: string;
  name: string;
  role: DeploymentCrewRole;
}

export interface Lead {
  id: string;
  site: string;
  city: string;
  headcount: number;
  duration: number;
  stage: LeadStage;
  status: string;
  triageBadge?: TriageBadge;
  rep: string;
  repId: string;
  lat?: number;
  lng?: number;
  plannedStart?: string;
  plannedEnd?: string;
  deviceCount?: number;
  rawMetadata: Record<string, unknown>;
  verifier?: string;
  verifierStaffId?: string;
  visitDate?: string;
  /** Role of the person in the verifier assignment row (from metadata). */
  visitVerifierRole?: VisitRole;
  visitSecondaryStaffId?: string;
  visitSecondaryName?: string;
  visitSecondaryDate?: string;
  visitSecondaryRole?: VisitRole;
  shipper?: string;
  shipperStaffId?: string;
  deployer?: string;
  deployerStaffId?: string;
  deployDate?: string;
  deployTime?: string;
  deploymentRegion?: string;
  deploymentDeviceCount?: number;
  shipmentExpectedDelivery?: string;
  shipmentCarrier?: string;
  shipmentTracking?: string;
  shipmentLogisticsNotes?: string;
  deploymentCrew: DeploymentCrewMember[];
  address?: string;
  industry?: string;
  shifts?: number;
  workersPerShift?: number;
  contactName?: string;
  contactPhone?: string;
  notes?: string;
}

export interface DeviceNode {
  id: string;
  orgId: string | null;
  city: string;
  latitude: number;
  longitude: number;
  available: number;
}

export interface Operator {
  name: string;
  id: string;
  role?: string;
}

function parseVisitRole(v: unknown): VisitRole | undefined {
  if (v === "customer_success" || v === "chief_operator") return v;
  return undefined;
}

function parseCrew(raw: unknown, staffLookup: Map<string, string>): DeploymentCrewMember[] {
  if (!Array.isArray(raw)) return [];
  const out: DeploymentCrewMember[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const sid = typeof o.staff_id === "string" ? o.staff_id : typeof o.staffId === "string" ? o.staffId : "";
    if (!sid) continue;
    const role = o.role === "chief_operator" ? "chief_operator" : "operator";
    out.push({
      staffId: sid,
      name: staffLookup.get(sid) ?? sid,
      role,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// API → UI adapters
// ---------------------------------------------------------------------------

const STATUS_TO_STAGE: Record<string, LeadStage> = {
  /** Accepted deals leave Sales; scheduling happens only in the CS column. */
  accepted: "Customer Success",
  pending_visit: "Customer Success",
  pending_allocation: "Allocation",
  pending_shipment: "Shipment",
  pending_deployment: "Deployment",
  deployed: "Deployment",
};

const STATUS_TO_TRIAGE_BADGE: Record<string, TriageBadge> = {
  lead: "New",
  confirmed: "Confirmed",
  accepted: "Accepted",
  deferred: "Deferred",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export function adaptLead(
  api: OpsLead,
  staffLookup: Map<string, string>,
  assignments?: OpsLeadAssignment[],
): Lead {
  const stage: LeadStage = STATUS_TO_STAGE[api.status] ?? "Sales";
  const triageBadge: TriageBadge | undefined = STATUS_TO_TRIAGE_BADGE[api.status];

  const plannedStart = api.planned_start ?? undefined;
  const plannedEnd = api.planned_end ?? undefined;
  const durationDays =
    plannedStart && plannedEnd
      ? Math.ceil(
          (new Date(plannedEnd).getTime() - new Date(plannedStart).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

  const verifierAssign = assignments?.find((a) => a.assignment_type === "verifier");
  const shipperAssign = assignments?.find((a) => a.assignment_type === "shipper");
  const deployerAssign = assignments?.find((a) => a.assignment_type === "deployer");

  const m = api.metadata ?? {};
  const visitVerifierRole = parseVisitRole(m[META_VISIT_VERIFIER_ROLE]);
  const secId = typeof m[META_VISIT_SECONDARY_STAFF_ID] === "string" ? m[META_VISIT_SECONDARY_STAFF_ID] : undefined;
  const secDate =
    typeof m[META_VISIT_SECONDARY_SCHEDULED_DATE] === "string" ? m[META_VISIT_SECONDARY_SCHEDULED_DATE] : undefined;
  const visitSecondaryRole = parseVisitRole(m[META_VISIT_SECONDARY_ROLE]);

  return {
    id: api.id,
    site: api.factory_name,
    city: api.city ?? "",
    headcount: api.worker_count ?? 0,
    duration: durationDays,
    stage,
    status: api.status,
    triageBadge,
    rep: staffLookup.get(api.staff_id) ?? api.staff_id,
    repId: api.staff_id,
    lat: api.lat ?? undefined,
    lng: api.lng ?? undefined,
    plannedStart: plannedStart ?? undefined,
    plannedEnd: plannedEnd ?? undefined,
    deviceCount: api.device_count ?? undefined,
    rawMetadata: { ...m },
    verifier: verifierAssign
      ? staffLookup.get(verifierAssign.staff_id) ?? verifierAssign.staff_id
      : undefined,
    verifierStaffId: verifierAssign?.staff_id,
    visitDate: verifierAssign?.scheduled_date ?? undefined,
    visitVerifierRole,
    visitSecondaryStaffId: secId,
    visitSecondaryName: secId ? staffLookup.get(secId) ?? secId : undefined,
    visitSecondaryDate: secDate,
    visitSecondaryRole,
    shipper: shipperAssign
      ? staffLookup.get(shipperAssign.staff_id) ?? shipperAssign.staff_id
      : undefined,
    shipperStaffId: shipperAssign?.staff_id,
    deployer: deployerAssign
      ? staffLookup.get(deployerAssign.staff_id) ?? deployerAssign.staff_id
      : undefined,
    deployerStaffId: deployerAssign?.staff_id,
    deployDate: deployerAssign?.scheduled_date ?? undefined,
    deployTime: deployerAssign?.scheduled_time ?? undefined,
    deploymentRegion:
      m.deployment_id != null && String(m.deployment_id).length > 0 ? (api.city ?? undefined) : undefined,
    deploymentDeviceCount:
      m.deployment_id != null && String(m.deployment_id).length > 0 ? (api.device_count ?? undefined) : undefined,
    shipmentExpectedDelivery:
      typeof m[META_SHIPMENT_EXPECTED_DELIVERY] === "string" ? m[META_SHIPMENT_EXPECTED_DELIVERY] : undefined,
    shipmentCarrier: typeof m[META_SHIPMENT_CARRIER] === "string" ? m[META_SHIPMENT_CARRIER] : undefined,
    shipmentTracking: typeof m[META_SHIPMENT_TRACKING] === "string" ? m[META_SHIPMENT_TRACKING] : undefined,
    shipmentLogisticsNotes:
      typeof m[META_SHIPMENT_LOGISTICS_NOTES] === "string" ? m[META_SHIPMENT_LOGISTICS_NOTES] : undefined,
    deploymentCrew: parseCrew(m[META_DEPLOYMENT_CREW], staffLookup),
    address: api.address ?? undefined,
    industry: api.industry ?? undefined,
    shifts: api.shifts ?? undefined,
    workersPerShift: api.workers_per_shift ?? undefined,
    contactName: api.contact_name ?? undefined,
    contactPhone: api.contact_phone ?? undefined,
    notes: api.notes ?? undefined,
  };
}

export function adaptStaff(staff: OpsStaff): Operator {
  return { name: staff.display_name, id: staff.id, role: staff.role ?? undefined };
}

// ---------------------------------------------------------------------------
// Visit helpers — at least one site visitor required before verify
// ---------------------------------------------------------------------------

export function visitHasSiteVisitor(lead: Lead): boolean {
  return Boolean(lead.verifierStaffId || lead.visitSecondaryStaffId);
}

export function visitHasCustomerSuccess(lead: Lead): boolean {
  return lead.visitVerifierRole === "customer_success" || lead.visitSecondaryRole === "customer_success";
}

export function visitHasChiefOperator(lead: Lead): boolean {
  return lead.visitVerifierRole === "chief_operator" || lead.visitSecondaryRole === "chief_operator";
}

export function visitCanAddSecondary(lead: Lead): boolean {
  return Boolean(lead.verifierStaffId) && !lead.visitSecondaryStaffId;
}

/**
 * Roles still needed for site visits (CS vs chief). Used to populate the role
 * dropdown so the second slot cannot repeat a role that is already assigned.
 */
export function visitRolesStillNeeded(lead: Lead): VisitRole[] {
  const need: VisitRole[] = [];
  if (!visitHasCustomerSuccess(lead)) need.push("customer_success");
  if (!visitHasChiefOperator(lead)) need.push("chief_operator");
  return need;
}

/**
 * Whether **Confirm deployed** may run: at least one `deployment_crew` member must exist
 * on the lead (set via **Plan deployment crew**). The UI blocks deploy until then; backends
 * should reject `POST .../deploy` if crew is missing for defense in depth.
 */
export function canConfirmDeploymentComplete(lead: Lead): boolean {
  return lead.deploymentCrew.length > 0;
}

// ---------------------------------------------------------------------------
// Kanban transition rules
// ---------------------------------------------------------------------------

export type TransitionAction = "assign-verifier" | "verify" | "allocate" | "deliver";

export interface TransitionRule {
  action: TransitionAction;
  needsInput: boolean;
}

export const VALID_TRANSITIONS: Record<string, TransitionRule> = {
  "Sales->Customer Success": { action: "assign-verifier", needsInput: true },
  "Customer Success->Allocation": { action: "verify", needsInput: false },
  "Allocation->Shipment": { action: "allocate", needsInput: true },
  "Shipment->Deployment": { action: "deliver", needsInput: false },
};

export function getTransitionRule(from: LeadStage, to: LeadStage): TransitionRule | null {
  return VALID_TRANSITIONS[`${from}->${to}`] ?? null;
}

export function mapVisualStatusForLead(lead: Lead): string {
  if (lead.stage === "Deployment") {
    return lead.status === "deployed" ? "deployed" : "deploying";
  }
  if (lead.stage === "Sales") return "new";
  if (lead.stage === "Customer Success") return "new";
  if (lead.stage === "Allocation") return "allocating";
  if (lead.stage === "Shipment") return "shipping";
  return "new";
}

const MAP_VISUAL_STATUS_RANK: Record<string, number> = {
  new: 0,
  allocating: 1,
  shipping: 2,
  deploying: 3,
  deployed: 4,
};

export function maxMapVisualStatus(statuses: string[]): string {
  let best = "new";
  let bestRank = -1;
  for (const s of statuses) {
    const r = MAP_VISUAL_STATUS_RANK[s] ?? 0;
    if (r > bestRank) {
      bestRank = r;
      best = s;
    }
  }
  return best;
}

export function isManualLead(lead: Lead): boolean {
  return lead.rawMetadata?.manual_entry === true;
}

export function canDrag(lead: Lead): boolean {
  if (isManualLead(lead)) return false;
  if (lead.status === "deployed") return false;
  /** Sales holds pre-accept triage only; moves to CS happen after accept (status + column). */
  if (lead.stage === "Sales") return false;
  return true;
}

export function adaptLocation(loc: OpsLocation): DeviceNode | null {
  if (!loc.lat || !loc.lng) return null;
  return {
    id: loc.id,
    orgId: loc.org_id,
    city: loc.name,
    latitude: loc.lat,
    longitude: loc.lng,
    available: 0,
  };
}

export const CITY_COORDS: Record<string, [number, number]> = {
  Delhi: [28.6139, 77.209],
  Mumbai: [19.076, 72.8777],
  Bengaluru: [12.9716, 77.5946],
  Chennai: [13.0827, 80.2707],
  Hyderabad: [17.385, 78.4867],
  Pune: [18.5204, 73.8567],
  Kolkata: [22.5726, 88.3639],
  Surat: [21.1702, 72.8311],
  Jaipur: [26.9124, 75.7873],
  Ahmedabad: [23.0225, 72.5714],
  Coimbatore: [11.0168, 76.9558],
  Tirupur: [11.1085, 77.3411],
  Indore: [22.7196, 75.8577],
  Lucknow: [26.8467, 80.9462],
};
