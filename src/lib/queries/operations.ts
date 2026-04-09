"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptOpsLead,
  allocateOpsLead,
  assignOpsDeployer,
  assignOpsShipper,
  assignOpsVerifier,
  deferOpsLead,
  deliverOpsLead,
  deployOpsLead,
  dispatchOpsLead,
  fetchOpsCentres,
  fetchOpsFactories,
  fetchOpsLeadAssignments,
  fetchOpsLeads,
  fetchOpsLocations,
  fetchOpsShipmentForDeployment,
  fetchOpsSiteV2Summary,
  fetchOpsStaff,
  fetchOpsStaffByRole,
  fetchOpsTaskChecklists,
  rejectOpsLead,
  updateOpsLead,
  upsertOpsTaskChecklist,
  verifyOpsLead,
  type OpsChecklistItem,
} from "@/lib/api/browser-api";
import { META } from "@/lib/ops/lead-metadata";
import { operationsKeys } from "@/lib/queries/keys";

export function useOpsLeads() {
  return useQuery({
    queryKey: operationsKeys.opsLeads(),
    queryFn: () => fetchOpsLeads(),
    staleTime: 5_000,
  });
}

export function useOpsLeadAssignments(leadIds: string[]) {
  return useQuery({
    queryKey: operationsKeys.opsLeadAssignments(leadIds),
    queryFn: async () => {
      const results = await Promise.all(
        leadIds.map((id) =>
          fetchOpsLeadAssignments(id).then((r) => ({ leadId: id, items: r.items })),
        ),
      );
      const map = new Map<string, Awaited<ReturnType<typeof fetchOpsLeadAssignments>>["items"]>();
      for (const { leadId, items } of results) {
        map.set(leadId, items);
      }
      return map;
    },
    enabled: leadIds.length > 0,
    staleTime: 30_000,
  });
}

export function useOpsStaff() {
  return useQuery({
    queryKey: operationsKeys.opsStaff(),
    queryFn: () => fetchOpsStaff(),
    staleTime: 60_000,
  });
}

export function useOpsOperators() {
  return useQuery({
    queryKey: operationsKeys.opsOperators(),
    queryFn: () => fetchOpsStaffByRole("ops_operator"),
    staleTime: 60_000,
  });
}

export function useOpsLocations(activeOnly = true) {
  return useQuery({
    queryKey: operationsKeys.opsLocations(),
    queryFn: () => fetchOpsLocations(activeOnly),
    staleTime: 60_000,
  });
}

export function useOpsFactories(pipelineStatus?: string) {
  return useQuery({
    queryKey: operationsKeys.opsFactories(pipelineStatus),
    queryFn: () => fetchOpsFactories(pipelineStatus),
    staleTime: 5_000,
  });
}

export function useOpsSiteV2Summary(siteId: string | null) {
  return useQuery({
    queryKey: operationsKeys.opsSiteV2Summary(siteId ?? ""),
    queryFn: () => fetchOpsSiteV2Summary(siteId!),
    enabled: Boolean(siteId),
    staleTime: 30_000,
  });
}

export function useOpsCentres() {
  return useQuery({
    queryKey: operationsKeys.opsCentres(),
    queryFn: () => fetchOpsCentres(),
    staleTime: 60_000,
  });
}

export function useOpsShipmentForDeployment(deploymentId: string | null) {
  return useQuery({
    queryKey: operationsKeys.opsShipmentForDeployment(deploymentId ?? ""),
    queryFn: () => fetchOpsShipmentForDeployment(deploymentId!),
    enabled: Boolean(deploymentId),
    staleTime: 15_000,
  });
}

function invalidateLeads(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: operationsKeys.opsLeads(), refetchType: "all" });
  qc.invalidateQueries({
    queryKey: [...operationsKeys.all, "ops-lead-assignments"],
    refetchType: "all",
  });
  /** V2 factory-centric data + logistics views stay in sync with lead mutations. */
  qc.invalidateQueries({ queryKey: [...operationsKeys.all, "ops-factories"], refetchType: "all" });
  qc.invalidateQueries({ queryKey: [...operationsKeys.all, "ops-centres"], refetchType: "all" });
  qc.invalidateQueries({
    queryKey: [...operationsKeys.all, "ops-shipment-for-deployment"],
    refetchType: "all",
  });
  qc.invalidateQueries({
    queryKey: [...operationsKeys.all, "ops-site-v2-summary"],
    refetchType: "all",
  });
}

export function useAcceptOpsLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) => acceptOpsLead(leadId),
    onSettled: () => invalidateLeads(qc),
  });
}

export function useRejectOpsLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) => rejectOpsLead(leadId),
    onSettled: () => invalidateLeads(qc),
  });
}

export function useAssignOpsVerifier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      leadId,
      staff_id,
      scheduled_date,
      notes,
    }: {
      leadId: string;
      staff_id: string;
      scheduled_date?: string;
      notes?: string;
    }) => assignOpsVerifier(leadId, { staff_id, scheduled_date, notes }),
    onSettled: () => invalidateLeads(qc),
  });
}

export function useVerifyOpsLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) => verifyOpsLead(leadId),
    onSettled: () => {
      invalidateLeads(qc);
      qc.invalidateQueries({ queryKey: operationsKeys.opsSites() });
    },
  });
}

/** CS verification: API verify + persist on-ground headcount for allocation column. */
export function useVerifyOpsLeadWithCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      leadId,
      verifiedWorkerCount,
    }: {
      leadId: string;
      verifiedWorkerCount: number;
    }) => {
      await verifyOpsLead(leadId);
      const list = await fetchOpsLeads();
      const raw = list.items.find((l) => l.id === leadId);
      const merged = {
        ...(raw?.metadata ?? {}),
        [META.VERIFIED_WORKER_COUNT]: verifiedWorkerCount,
      };
      return updateOpsLead(leadId, {
        worker_count: verifiedWorkerCount,
        metadata: merged,
      });
    },
    onSettled: () => {
      invalidateLeads(qc);
      qc.invalidateQueries({ queryKey: operationsKeys.opsSites() });
    },
  });
}

/** Shallow-merge keys into existing lead metadata (fetches current list first). */
export function useMergeOpsLeadMetadata() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      leadId,
      patch,
    }: {
      leadId: string;
      patch: Record<string, unknown>;
    }) => {
      const list = await fetchOpsLeads();
      const raw = list.items.find((l) => l.id === leadId);
      const merged = { ...(raw?.metadata ?? {}), ...patch };
      return updateOpsLead(leadId, { metadata: merged });
    },
    onSettled: () => invalidateLeads(qc),
  });
}

/** PATCH lead (metadata merge should be done by caller — server replaces jsonb). */
export function useUpdateOpsLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      leadId,
      body,
    }: {
      leadId: string;
      body: Parameters<typeof updateOpsLead>[1];
    }) => updateOpsLead(leadId, body),
    onSettled: () => {
      invalidateLeads(qc);
    },
  });
}

export function useAllocateOpsLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      leadId,
      source_location_id,
      operator_org_id,
      device_count,
      notes,
    }: {
      leadId: string;
      source_location_id: string;
      operator_org_id: string;
      device_count: number;
      notes?: string;
    }) =>
      allocateOpsLead(leadId, {
        source_location_id,
        operator_org_id,
        device_count,
        notes,
      }),
    onSettled: () => {
      invalidateLeads(qc);
      qc.invalidateQueries({ queryKey: operationsKeys.opsLocations() });
    },
  });
}

export function useAssignOpsShipper() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      leadId,
      staff_id,
      scheduled_date,
      notes,
    }: {
      leadId: string;
      staff_id: string;
      scheduled_date?: string;
      notes?: string;
    }) => assignOpsShipper(leadId, { staff_id, scheduled_date, notes }),
    onSettled: () => invalidateLeads(qc),
  });
}

export function useDispatchOpsLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) => dispatchOpsLead(leadId),
    onSettled: () => invalidateLeads(qc),
  });
}

export function useDeliverOpsLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) => deliverOpsLead(leadId),
    onSettled: () => invalidateLeads(qc),
  });
}

export function useAssignOpsDeployer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      leadId,
      staff_id,
      scheduled_date,
      scheduled_time,
      notes,
    }: {
      leadId: string;
      staff_id: string;
      scheduled_date?: string;
      scheduled_time?: string;
      notes?: string;
    }) =>
      assignOpsDeployer(leadId, { staff_id, scheduled_date, scheduled_time, notes }),
    onSettled: () => invalidateLeads(qc),
  });
}

export function useDeployOpsLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) => deployOpsLead(leadId),
    onSettled: () => {
      invalidateLeads(qc);
      qc.invalidateQueries({ queryKey: operationsKeys.opsSites() });
    },
  });
}

export function useOpsTaskChecklists() {
  return useQuery({
    queryKey: operationsKeys.opsTaskChecklists(),
    queryFn: () => fetchOpsTaskChecklists(),
    staleTime: 60_000,
  });
}

export function useUpsertOpsTaskChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      assignmentType,
      title,
      items,
      instructions,
    }: {
      assignmentType: string;
      title: string;
      items: OpsChecklistItem[];
      instructions?: string | null;
    }) => upsertOpsTaskChecklist(assignmentType, { title, items, instructions }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: operationsKeys.opsTaskChecklists() });
    },
  });
}

export function useDeferOpsLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) => deferOpsLead(leadId),
    onSettled: () => invalidateLeads(qc),
  });
}
