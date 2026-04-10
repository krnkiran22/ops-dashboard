/**
 * Ops CRM browser API — types and fetch helpers for `OpsKanbanPage` and related components
 * in **buildai-ops** (historically shared with the monorepo dashboard). Built on the `api` client.
 *
 * Paths are relative to `{base}/{gateway}/ops` (e.g. `/v2/ops/leads` when the gateway
 * segment is `v2`). The v2 Python mock implements the routes in `docs/ops-v2-mock-api.md`.
 * V2 additions: `GET /ops/factories`, `GET /ops/sites/{id}/v2-summary`,
 * `GET /ops/centres`, `GET /ops/shipments/for-deployment/{deployment_id}`.
 * Legacy helpers (`confirm`, `cancel`, some `sites` list routes) may be absent on the mock.
 */

import { api, fetchOpsServerHealth } from "@/lib/api/client";

export { fetchOpsServerHealth };

// =============================================================================
// Ops: Leads
// =============================================================================

export interface OpsLead {
  id: string;
  staff_id: string;
  site_id: string | null;
  factory_name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  worker_count: number | null;
  contact_name: string | null;
  contact_phone: string | null;
  lat: number | null;
  lng: number | null;
  planned_start: string | null;
  planned_end: string | null;
  device_count: number | null;
  industry: string | null;
  shifts: number | null;
  workers_per_shift: number | null;
  status: string;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OpsLeadsResponse {
  items: OpsLead[];
  total: number;
  has_more: boolean;
}

export async function fetchOpsLeads(staffId?: string): Promise<OpsLeadsResponse> {
  return api.get<OpsLeadsResponse>("/ops/leads", {
    ...(staffId ? { staff_id: staffId } : {}),
  });
}

export async function updateOpsLead(
  leadId: string,
  body: {
    status?: string;
    factory_name?: string;
    address?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    worker_count?: number;
    contact_name?: string;
    contact_phone?: string;
    lat?: number;
    lng?: number;
    planned_start?: string;
    planned_end?: string;
    device_count?: number;
    notes?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<OpsLead> {
  return api.patch<OpsLead>(`/ops/leads/${leadId}`, body);
}

// =============================================================================
// Ops: Staff
// =============================================================================

export interface OpsStaff {
  id: string;
  display_name: string;
  phone: string | null;
  email: string | null;
  status: string;
  role: string | null;
}

export interface OpsStaffListResponse {
  items: OpsStaff[];
  total: number;
  has_more: boolean;
}

export async function fetchOpsStaff(): Promise<OpsStaffListResponse> {
  return api.get<OpsStaffListResponse>("/ops/staff");
}

export async function fetchOpsStaffByRole(role: string): Promise<OpsStaffListResponse> {
  return api.get<OpsStaffListResponse>("/ops/staff", { role });
}

// =============================================================================
// Ops: Staff Assignments
// =============================================================================

export interface OpsStaffAssignment {
  id: string;
  staff_id: string;
  site_id: string;
  deployment_id: string | null;
  assignment_date: string;
  status: string;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  staff_display_name?: string;
  site_name?: string;
}

export interface OpsStaffAssignmentsResponse {
  items: OpsStaffAssignment[];
  total: number;
  has_more: boolean;
}

export async function fetchOpsStaffAssignments(
  staffId?: string,
): Promise<OpsStaffAssignmentsResponse> {
  return api.get<OpsStaffAssignmentsResponse>("/ops/staff-assignments", {
    ...(staffId ? { staff_id: staffId } : {}),
  });
}

export async function createOpsStaffAssignment(body: {
  staff_id: string;
  site_id: string;
  deployment_id?: string;
  assignment_date: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}): Promise<OpsStaffAssignment> {
  return api.post<OpsStaffAssignment>("/ops/staff-assignments", body);
}

export async function confirmOpsStaffAssignment(
  assignmentId: string,
): Promise<OpsStaffAssignment> {
  return api.post<OpsStaffAssignment>(
    `/ops/staff-assignments/${assignmentId}/confirm`,
  );
}

export async function rejectOpsStaffAssignment(
  assignmentId: string,
): Promise<OpsStaffAssignment> {
  return api.post<OpsStaffAssignment>(
    `/ops/staff-assignments/${assignmentId}/reject`,
  );
}

// =============================================================================
// Ops: Sites
// =============================================================================

export interface OpsSite {
  id: string;
  name: string;
  display_id: string;
  address: string | null;
  city: string | null;
  status: string;
}

export interface OpsSitesResponse {
  items: OpsSite[];
  total: number;
  has_more: boolean;
}

export async function fetchOpsSites(): Promise<OpsSitesResponse> {
  return api.get<OpsSitesResponse>("/ops/sites");
}

// =============================================================================
// Ops: Locations
// =============================================================================

export interface OpsLocation {
  id: string;
  slug: string;
  name: string;
  location_type: string;
  org_id: string | null;
  is_active: boolean;
  lat: number | null;
  lng: number | null;
  region: string | null;
  shipping_address: string | null;
  metadata: Record<string, unknown>;
}

export interface OpsLocationsResponse {
  items: OpsLocation[];
  total: number;
  has_more: boolean;
}

export async function fetchOpsLocations(activeOnly = false): Promise<OpsLocationsResponse> {
  return api.get<OpsLocationsResponse>("/ops/locations", {
    ...(activeOnly ? { active_only: "true" } : {}),
  });
}

// =============================================================================
// Ops: Factories (V2 factory-centric kanban)
// =============================================================================

export interface OpsFactory {
  site_id: string;
  factory_name: string;
  production_type: string | null;
  worker_count: number | null;
  team_lead_staff_id: string | null;
  team_cs_staff_id: string | null;
  pipeline_status: string;
  industry: string | null;
  shifts: number | null;
}

export interface OpsFactoriesResponse {
  items: OpsFactory[];
  total: number;
  has_more: boolean;
}

/** Optional `pipeline_status` loads a single kanban column (matches v2 mock). */
export async function fetchOpsFactories(
  pipelineStatus?: string,
): Promise<OpsFactoriesResponse> {
  return api.get<OpsFactoriesResponse>("/ops/factories", {
    ...(pipelineStatus ? { pipeline_status: pipelineStatus } : {}),
  });
}

// =============================================================================
// Ops: Site v2 summary (enriched factory card / operator views)
// =============================================================================

export interface OpsStaffMini {
  id: string;
  display_name: string;
}

export interface OpsFactorySiteSummary {
  site_id: string;
  factory_name: string;
  pipeline_status: string;
  worker_count: number | null;
  industry: string | null;
  shifts: number | null;
  team_lead?: OpsStaffMini | null;
  team_cs?: OpsStaffMini | null;
  devices_deployed?: number | null;
  recent_allocations?: unknown[];
}

export async function fetchOpsSiteV2Summary(
  siteId: string,
): Promise<OpsFactorySiteSummary> {
  return api.get<OpsFactorySiteSummary>(`/ops/sites/${siteId}/v2-summary`);
}

// =============================================================================
// Ops: Centres (warehouses / hubs + device_count for logistics map)
// =============================================================================

export interface OpsCentre {
  id: string;
  name: string;
  location_type: string;
  is_active: boolean;
  lat: number | null;
  lng: number | null;
  device_count: number;
}

export interface OpsCentresResponse {
  items: OpsCentre[];
  total: number;
  has_more: boolean;
}

export async function fetchOpsCentres(): Promise<OpsCentresResponse> {
  return api.get<OpsCentresResponse>("/ops/centres");
}

// =============================================================================
// Ops: Shipments
// =============================================================================

export interface OpsShipment {
  id: string;
  shipment_type: string;
  status: string;
  source_location_id: string | null;
  dest_location_id: string | null;
  shipment_date: string;
  received_date: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
}

export interface OpsShipmentsResponse {
  items: OpsShipment[];
  total: number;
  has_more: boolean;
}

export async function fetchOpsShipments(status?: string): Promise<OpsShipmentsResponse> {
  return api.get<OpsShipmentsResponse>("/ops/shipments", {
    ...(status ? { status } : {}),
  });
}

/** V2: shipment row for a deployment (carrier, ETA, tracking). */
export interface OpsShipmentForDeployment {
  id?: string;
  vendor?: string | null;
  transport_mode?: string | null;
  poc_staff_id?: string | null;
  departed_at?: string | null;
  eta?: string | null;
  tracking_reference?: string | null;
  allocation_id?: string | null;
  status?: string;
  metadata?: Record<string, unknown>;
}

export async function fetchOpsShipmentForDeployment(
  deploymentId: string,
): Promise<OpsShipmentForDeployment> {
  return api.get<OpsShipmentForDeployment>(
    `/ops/shipments/for-deployment/${deploymentId}`,
  );
}

// =============================================================================
// Ops: Lead assignments
// =============================================================================

export interface OpsLeadAssignment {
  id: string;
  lead_id: string;
  staff_id: string;
  assignment_type: "verifier" | "shipper" | "deployer";
  scheduled_date: string | null;
  scheduled_time: string | null;
  status: string;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OpsLeadAssignmentsResponse {
  items: OpsLeadAssignment[];
  total: number;
  has_more: boolean;
}

export async function fetchOpsLeadAssignments(
  leadId: string,
): Promise<OpsLeadAssignmentsResponse> {
  return api.get<OpsLeadAssignmentsResponse>(`/ops/leads/${leadId}/assignments`);
}

// =============================================================================
// Ops: Lead pipeline actions
// =============================================================================

export async function confirmOpsLead(leadId: string): Promise<OpsLead> {
  return api.post<OpsLead>(`/ops/leads/${leadId}/confirm`);
}

export async function acceptOpsLead(leadId: string): Promise<OpsLead> {
  return api.post<OpsLead>(`/ops/leads/${leadId}/accept`);
}

export async function rejectOpsLead(leadId: string): Promise<OpsLead> {
  return api.post<OpsLead>(`/ops/leads/${leadId}/reject`);
}

export async function cancelOpsLead(leadId: string): Promise<OpsLead> {
  return api.post<OpsLead>(`/ops/leads/${leadId}/cancel`);
}

export async function deferOpsLead(leadId: string): Promise<OpsLead> {
  return api.post<OpsLead>(`/ops/leads/${leadId}/defer`);
}

export async function assignOpsVerifier(
  leadId: string,
  body: { staff_id: string; scheduled_date?: string; notes?: string },
): Promise<OpsLeadAssignment> {
  return api.post<OpsLeadAssignment>(`/ops/leads/${leadId}/assign-verifier`, body);
}

export async function verifyOpsLead(leadId: string): Promise<OpsLead> {
  return api.post<OpsLead>(`/ops/leads/${leadId}/verify`);
}

export async function allocateOpsLead(
  leadId: string,
  body: {
    source_location_id: string;
    operator_org_id: string;
    device_count: number;
    notes?: string;
  },
): Promise<OpsLead> {
  return api.post<OpsLead>(`/ops/leads/${leadId}/allocate`, body);
}

export async function assignOpsShipper(
  leadId: string,
  body: { staff_id: string; scheduled_date?: string; notes?: string },
): Promise<OpsLeadAssignment> {
  return api.post<OpsLeadAssignment>(`/ops/leads/${leadId}/assign-shipper`, body);
}

export async function dispatchOpsLead(leadId: string): Promise<OpsLead> {
  return api.post<OpsLead>(`/ops/leads/${leadId}/dispatch`);
}

export async function deliverOpsLead(leadId: string): Promise<OpsLead> {
  return api.post<OpsLead>(`/ops/leads/${leadId}/deliver`);
}

export async function assignOpsDeployer(
  leadId: string,
  body: {
    staff_id: string;
    scheduled_date?: string;
    scheduled_time?: string;
    notes?: string;
  },
): Promise<OpsLeadAssignment> {
  return api.post<OpsLeadAssignment>(`/ops/leads/${leadId}/assign-deployer`, body);
}

export async function deployOpsLead(leadId: string): Promise<OpsLead> {
  return api.post<OpsLead>(`/ops/leads/${leadId}/deploy`);
}

// =============================================================================
// Ops: Task checklists
// =============================================================================

export interface OpsChecklistItem {
  label: string;
  required: boolean;
}

export interface OpsTaskChecklist {
  id: string;
  assignment_type: string;
  title: string;
  items: OpsChecklistItem[];
  instructions: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchOpsTaskChecklists(): Promise<{ items: OpsTaskChecklist[] }> {
  return api.get<{ items: OpsTaskChecklist[] }>("/ops/task-checklists");
}

export async function upsertOpsTaskChecklist(
  assignmentType: string,
  body: { title: string; items: OpsChecklistItem[]; instructions?: string | null },
): Promise<OpsTaskChecklist> {
  return api.put<OpsTaskChecklist>(
    `/ops/task-checklists/${assignmentType}`,
    body,
  );
}
