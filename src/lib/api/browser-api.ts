/**
 * Ops CRM browser API — subset of the main dashboard `browser-api` used by
 * `OpsKanbanPage` and related components. Built on the shared `api` client.
 */

import { api } from "@/lib/api/client";

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
