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
  opsLeadAssignments: (leadIds: string[]) =>
    [...operationsKeys.all, "ops-lead-assignments", ...leadIds] as const,
  opsShipments: (status?: string) =>
    [...operationsKeys.all, "ops-shipments", status] as const,
  opsTaskChecklists: () => [...operationsKeys.all, "ops-task-checklists"] as const,
};
