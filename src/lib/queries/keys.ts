/**
 * React Query key factory for ops CRM / kanban (mirrors dashboard `operationsKeys` slice).
 */

export const operationsKeys = {
  all: ["operations"] as const,
  opsLeads: () => [...operationsKeys.all, "ops-leads"] as const,
  opsStaff: () => [...operationsKeys.all, "ops-staff"] as const,
  opsOperators: () => [...operationsKeys.all, "ops-operators"] as const,
  opsStaffAssignments: () => [...operationsKeys.all, "ops-staff-assignments"] as const,
  opsSites: () => [...operationsKeys.all, "ops-sites"] as const,
  opsLocations: () => [...operationsKeys.all, "ops-locations"] as const,
  opsFactories: (pipelineStatus?: string) =>
    [...operationsKeys.all, "ops-factories", pipelineStatus ?? "all"] as const,
  opsSiteV2Summary: (siteId: string) =>
    [...operationsKeys.all, "ops-site-v2-summary", siteId] as const,
  opsCentres: () => [...operationsKeys.all, "ops-centres"] as const,
  opsShipmentForDeployment: (deploymentId: string) =>
    [...operationsKeys.all, "ops-shipment-for-deployment", deploymentId] as const,
  opsLeadAssignments: (leadIds: string[]) =>
    [...operationsKeys.all, "ops-lead-assignments", ...leadIds] as const,
  opsShipments: (status?: string) =>
    [...operationsKeys.all, "ops-shipments", status] as const,
  opsTaskChecklists: () => [...operationsKeys.all, "ops-task-checklists"] as const,
};
