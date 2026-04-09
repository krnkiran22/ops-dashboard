/**
 * Staff-facing API functions for the ops portal.
 *
 * Auth is handled by Clerk — all authenticated endpoints use the JWT.
 * Self-registration creates an IAM role binding (ops_sales) on signup.
 */

import { api } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StaffProfile {
  id: string;
  display_name: string;
  phone: string | null;
  status: string;
  role: string | null;
}

export interface StaffAssignment {
  id: string;
  staff_id: string;
  site_id: string;
  assignment_date: string;
  status: string;
  notes: string | null;
  site_name?: string;
  site_address?: string;
  metadata?: Record<string, unknown>;
}

export interface StaffAssignmentListResponse {
  items: StaffAssignment[];
  total: number;
  has_more: boolean;
}

export interface Lead {
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
  industry?: string | null;
  shifts?: number | null;
  workers_per_shift?: number | null;
  status: string;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LeadListResponse {
  items: Lead[];
  total: number;
  has_more: boolean;
}

// ---------------------------------------------------------------------------
// Claim-token resolution (public — admin generates a link, staff opens it)
// ---------------------------------------------------------------------------

export interface StaffClaimResolveResponse {
  valid: boolean;
  claim_status: "pending" | "claimed" | "expired" | "revoked";
  display_name: string;
  phone: string | null;
  role: string | null;
  claimed_at: string | null;
}

export interface StaffClaimCompleteResponse {
  claim_status: string;
  claimed_at: string | null;
  role: string | null;
}

export function resolveStaffClaimToken(token: string) {
  return api.get<StaffClaimResolveResponse>(
    `/ops/staff/claim-tokens/${token}`,
    undefined,
    { skipAuth: true }
  );
}

export function completeStaffClaimToken(token: string, clerkUserId: string) {
  return api.post<StaffClaimCompleteResponse>(
    `/ops/staff/claim-tokens/${token}/complete`,
    { clerk_user_id: clerkUserId },
    { skipAuth: true }
  );
}

// ---------------------------------------------------------------------------
// Self-registration (public — called right after Clerk phone signup)
// ---------------------------------------------------------------------------

export interface SelfRegisterStaffRequest {
  clerk_user_id: string;
  display_name: string;
  phone: string;
  email?: string | null;
  clerk_provider?: string | null;
  role: "operator" | "sales";
}

export interface SelfRegisterStaffResponse {
  id: string;
  display_name: string;
  phone: string | null;
  email: string | null;
  role: string;
  status: string;
}

export function selfRegisterStaff(body: SelfRegisterStaffRequest) {
  return api.post<SelfRegisterStaffResponse>(
    "/ops/staff/register",
    body,
    { skipAuth: true }
  );
}

// ---------------------------------------------------------------------------
// Authenticated staff endpoints
// ---------------------------------------------------------------------------

export function fetchStaffMe() {
  return api.get<StaffProfile>("/ops/staff/me");
}

export interface LeadAssignment {
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

export interface LeadAssignmentListResponse {
  items: LeadAssignment[];
  total: number;
  has_more: boolean;
}

export function fetchMyLeadAssignments(assignmentType?: string, status?: string) {
  const params: Record<string, string> = {};
  if (assignmentType) params.assignment_type = assignmentType;
  if (status) params.status = status;
  return api.get<LeadAssignmentListResponse>("/ops/leads/my-assignments", params);
}

export interface ChecklistItem {
  label: string;
  required: boolean;
}

export interface TaskChecklist {
  id: string;
  assignment_type: string;
  title: string;
  items: ChecklistItem[];
  instructions: string | null;
  updated_at?: string;
}

export function fetchTaskChecklist(assignmentType: string) {
  return api.get<TaskChecklist>(`/ops/task-checklists/${assignmentType}`);
}

export interface StaffAssignmentListResponse {
  items: StaffAssignment[];
  total: number;
  has_more: boolean;
}

export function fetchStaffAssignments(staffId?: string) {
  return api.get<StaffAssignmentListResponse>("/ops/staff-assignments", {
    ...(staffId ? { staff_id: staffId } : {}),
  });
}

export function confirmAssignment(assignmentId: string) {
  return api.post<StaffAssignment>(
    `/ops/staff-assignments/${assignmentId}/confirm`
  );
}

export function rejectAssignment(assignmentId: string) {
  return api.post<StaffAssignment>(
    `/ops/staff-assignments/${assignmentId}/reject`
  );
}

export function confirmLeadAssignment(assignmentId: string) {
  return api.post<LeadAssignment>(
    `/ops/leads/my-assignments/${assignmentId}/confirm`
  );
}

export function rejectLeadAssignment(assignmentId: string) {
  return api.post<LeadAssignment>(
    `/ops/leads/my-assignments/${assignmentId}/reject`
  );
}

export function fetchLeads(staffId?: string) {
  return api.get<Lead[]>("/ops/leads", {
    ...(staffId ? { staff_id: staffId } : {}),
  });
}

export function confirmLead(leadId: string) {
  return api.post<Lead>(`/ops/leads/${leadId}/confirm`);
}

export function submitLead(body: {
  staff_id: string;
  factory_name: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  worker_count?: number;
  contact_name?: string;
  contact_phone?: string;
  lat?: number;
  lng?: number;
  planned_start?: string;
  planned_end?: string;
  device_count?: number;
  industry?: string;
  shifts?: number;
  workers_per_shift?: number;
  notes?: string;
  metadata?: Record<string, unknown>;
}) {
  return api.post<Lead>("/ops/leads", body);
}

export function updateLead(
  leadId: string,
  body: {
    status?: string;
    factory_name?: string;
    address?: string;
    city?: string;
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
  }
) {
  return api.patch<Lead>(`/ops/leads/${leadId}`, body);
}
