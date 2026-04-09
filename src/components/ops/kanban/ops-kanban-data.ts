/**
 * Kanban pipeline types, adapters, and city coordinate fallbacks.
 *
 * The Lead/Operator/DeviceNode types are the UI-facing shapes used by
 * LeadCard and the map. The adapt* functions bridge from the API types
 * (OpsLead, OpsStaff, OpsLocation, OpsLeadAssignment) to these UI shapes.
 *
 * Status vocabulary (canonical, from ops.lead_statuses):
 *   Triage:   lead, confirmed, accepted, rejected, cancelled, deferred
 *   Pipeline: pending_visit, pending_allocation, pending_shipment,
 *             pending_deployment, deployed
 */

import type { OpsLead, OpsStaff, OpsLocation, OpsLeadAssignment } from "@/lib/api/browser-api";

// ---------------------------------------------------------------------------
// Canonical status enum (mirrors backend LeadStatus)
// ---------------------------------------------------------------------------

export const LeadStatus = {
  // Triage
  LEAD: "lead",
  CONFIRMED: "confirmed",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
  DEFERRED: "deferred",
  // Pipeline
  PENDING_VISIT: "pending_visit",
  PENDING_ALLOCATION: "pending_allocation",
  PENDING_SHIPMENT: "pending_shipment",
  PENDING_DEPLOYMENT: "pending_deployment",
  DEPLOYED: "deployed",
} as const;

export type LeadStatusValue = (typeof LeadStatus)[keyof typeof LeadStatus];

/** Raw statuses still in the Sales column (not yet accepted into CS). `accepted` is CS queue. */
export const TRIAGE_STATUSES: Set<string> = new Set([
  LeadStatus.LEAD,
  LeadStatus.CONFIRMED,
  LeadStatus.REJECTED,
  LeadStatus.CANCELLED,
  LeadStatus.DEFERRED,
]);

export const TERMINAL_STATUSES: Set<string> = new Set([
  LeadStatus.REJECTED, LeadStatus.CANCELLED, LeadStatus.DEPLOYED,
]);

// ---------------------------------------------------------------------------
// Kanban column types
// ---------------------------------------------------------------------------

export type LeadStage =
  | "Leads"
  | "Pending Visit"
  | "Pending Allocation"
  | "Pending Shipment"
  | "Pending Deployment";

/** User-facing column titles (internal `LeadStage` keys stay API-stable). */
export const STAGE_DISPLAY_LABEL: Record<LeadStage, string> = {
  Leads: "Sales",
  "Pending Visit": "Customer Success (CS)",
  "Pending Allocation": "Allocation",
  "Pending Shipment": "Shipment",
  "Pending Deployment": "Deployment",
};

/** Short column subtitles for the kanban header. */
export const STAGE_COLUMN_DESCRIPTION: Record<LeadStage, string> = {
  Leads: "Referrals from sales — triage & accept",
  "Pending Visit": "Assign operators; verify real on-site potential vs. claimed headcount",
  "Pending Allocation": "Admins allocate devices from hubs (map above)",
  "Pending Shipment": "Ship to site — then hand off to deployment ops",
  "Pending Deployment": "Ops on the factory floor — schedule & confirm go-live",
};

/** Triage sub-badge shown inside the Leads column. */
export type TriageBadge = "New" | "Confirmed" | "Accepted" | "Deferred" | "Rejected" | "Cancelled";

export interface Lead {
  id: string;
  site: string;
  city: string;
  headcount: number;
  duration: number;
  stage: LeadStage;
  /** Raw API status for action dispatch. */
  status: string;
  /** Triage sub-badge (only meaningful when stage === "Leads"). */
  triageBadge?: TriageBadge;
  rep: string;
  repId: string;
  lat?: number;
  lng?: number;
  plannedStart?: string;
  plannedEnd?: string;
  deviceCount?: number;
  /* Assignments — populated from ops.lead_assignments, not metadata */
  verifier?: string;
  verifierStaffId?: string;
  visitDate?: string;
  shipper?: string;
  shipperStaffId?: string;
  deployer?: string;
  deployerStaffId?: string;
  deployDate?: string;
  deployTime?: string;
  /* Deployment — created at allocation time */
  deploymentRegion?: string;
  deploymentDeviceCount?: number;
  /* Factory profile fields */
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

// ---------------------------------------------------------------------------
// API → UI adapters
// ---------------------------------------------------------------------------

const STATUS_TO_STAGE: Record<string, LeadStage> = {
  /** Accepted into pipeline — queue in CS to assign someone to verify the site. */
  accepted: "Pending Visit",
  pending_visit: "Pending Visit",
  pending_allocation: "Pending Allocation",
  pending_shipment: "Pending Shipment",
  pending_deployment: "Pending Deployment",
};

const STATUS_TO_TRIAGE_BADGE: Record<string, TriageBadge> = {
  lead: "New",
  confirmed: "Confirmed",
  accepted: "Accepted",
  deferred: "Deferred",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

/** Map an API lead + its assignments to the UI Lead type. */
export function adaptLead(
  api: OpsLead,
  staffLookup: Map<string, string>,
  assignments?: OpsLeadAssignment[],
): Lead {
  // Sales column: new referrals still in triage. `accepted` and pipeline statuses map to CS + downstream columns.
  const stage: LeadStage = STATUS_TO_STAGE[api.status] ?? "Leads";
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

  // Resolve assignments by type
  const verifierAssign = assignments?.find((a) => a.assignment_type === "verifier");
  const shipperAssign = assignments?.find((a) => a.assignment_type === "shipper");
  const deployerAssign = assignments?.find((a) => a.assignment_type === "deployer");

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
    // Verifier (from lead_assignments)
    verifier: verifierAssign
      ? staffLookup.get(verifierAssign.staff_id) ?? verifierAssign.staff_id
      : undefined,
    verifierStaffId: verifierAssign?.staff_id,
    visitDate: verifierAssign?.scheduled_date ?? undefined,
    // Shipper (from lead_assignments)
    shipper: shipperAssign
      ? staffLookup.get(shipperAssign.staff_id) ?? shipperAssign.staff_id
      : undefined,
    shipperStaffId: shipperAssign?.staff_id,
    // Deployer (from lead_assignments)
    deployer: deployerAssign
      ? staffLookup.get(deployerAssign.staff_id) ?? deployerAssign.staff_id
      : undefined,
    deployerStaffId: deployerAssign?.staff_id,
    deployDate: deployerAssign?.scheduled_date ?? undefined,
    deployTime: deployerAssign?.scheduled_time ?? undefined,
    // Deployment info — derived from lead fields after allocation
    deploymentRegion: api.metadata?.deployment_id ? (api.city ?? undefined) : undefined,
    deploymentDeviceCount: api.metadata?.deployment_id ? (api.device_count ?? undefined) : undefined,
    // Factory profile
    address: api.address ?? undefined,
    industry: api.industry ?? undefined,
    shifts: api.shifts ?? undefined,
    workersPerShift: api.workers_per_shift ?? undefined,
    contactName: api.contact_name ?? undefined,
    contactPhone: api.contact_phone ?? undefined,
    notes: api.notes ?? undefined,
  };
}

/** Map API staff to the UI Operator type. */
export function adaptStaff(staff: OpsStaff): Operator {
  return { name: staff.display_name, id: staff.id, role: staff.role ?? undefined };
}

// ---------------------------------------------------------------------------
// Kanban transition rules — maps column transitions to required actions
// ---------------------------------------------------------------------------

export type TransitionAction =
  | "assign-verifier"
  | "verify"
  | "allocate"
  | "deliver"
  | "deploy";

export interface TransitionRule {
  action: TransitionAction;
  needsInput: boolean;
}

/** Valid forward-only column transitions with the required pipeline action. */
export const VALID_TRANSITIONS: Record<string, TransitionRule> = {
  "Leads->Pending Visit": { action: "assign-verifier", needsInput: true },
  "Pending Visit->Pending Allocation": { action: "verify", needsInput: false },
  "Pending Allocation->Pending Shipment": { action: "allocate", needsInput: true },
  "Pending Shipment->Pending Deployment": { action: "deliver", needsInput: false },
  "Pending Deployment->deployed": { action: "deploy", needsInput: false },
};

export function getTransitionRule(from: LeadStage, to: LeadStage): TransitionRule | null {
  return VALID_TRANSITIONS[`${from}->${to}`] ?? null;
}

/**
 * Sales column is action-only (accept / reject / defer) — no drag.
 * CS onward supports drag-to-advance where transitions allow it.
 */
export function canDrag(lead: Lead): boolean {
  if (lead.stage === "Leads") return false;
  return true;
}

/** Map API location to the UI DeviceNode type for the map. */
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

/** Lat/lng lookup by city name — used as fallback when lead has no lat/lng. */
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
