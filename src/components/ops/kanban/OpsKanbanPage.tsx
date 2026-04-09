"use client";

/**
 * Operations command center — resizable vertical split.
 *
 * Map (top) + Kanban pipeline (bottom) with resizable handle.
 * Fetches real data from the API via React Query hooks. Falls back
 * to mock data if the API is unavailable (dev/preview).
 */

import { useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import type { DeploymentPin } from "@/components/ops/devices/DeviceDeploymentMap";
import type { TransitRow } from "@/components/ops/shipments/InTransitTable";
import {
  type Lead,
  type LeadStage,
  CITY_COORDS,
  adaptLead,
  adaptStaff,
  adaptLocation,
  TERMINAL_STATUSES,
  STAGE_DISPLAY_LABEL,
} from "./ops-kanban-data";
import { KanbanBoard } from "./KanbanBoard";
import { UtilizationPanel } from "@/components/ops/inventory/UtilizationPanel";
import { ChecklistEditor } from "@/components/ops/checklists/ChecklistEditor";
import {
  useOpsLeads,
  useOpsLeadAssignments,
  useOpsStaff,
  useOpsOperators,
  useOpsLocations,
  useAcceptOpsLead,
  useAssignOpsVerifier,
  useVerifyOpsLead,
  useRejectOpsLead,
  useAllocateOpsLead,
  useAssignOpsShipper,
  useDispatchOpsLead,
  useDeliverOpsLead,
  useAssignOpsDeployer,
  useDeployOpsLead,
} from "@/lib/queries/operations";

const DeviceDeploymentMap = dynamic(
  () =>
    import("@/components/ops/devices/DeviceDeploymentMap").then((m) => ({
      default: m.DeviceDeploymentMap,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
        Loading map…
      </div>
    ),
  },
);

const STAGE_TO_MAP_STATUS: Record<LeadStage, string> = {
  Leads: "new",
  "Pending Visit": "new",
  "Pending Allocation": "allocating",
  "Pending Shipment": "shipping",
  "Pending Deployment": "deploying",
};

export function OpsKanbanPage() {
  // ── API data ──
  const leadsQuery = useOpsLeads();
  const staffQuery = useOpsStaff();
  const operatorsQuery = useOpsOperators();
  const locationsQuery = useOpsLocations();

  // ── Mutations ──
  const acceptLead = useAcceptOpsLead();
  const assignVerifier = useAssignOpsVerifier();
  const verifyLead = useVerifyOpsLead();
  const rejectLead = useRejectOpsLead();
  const allocateLead = useAllocateOpsLead();
  const assignShipper = useAssignOpsShipper();
  const dispatchLead = useDispatchOpsLead();
  const deliverLead = useDeliverOpsLead();
  const assignDeployer = useAssignOpsDeployer();
  const deployLead = useDeployOpsLead();

  // ── Build staff lookup for name resolution (all staff, including sales) ──
  const staffLookup = useMemo(() => {
    const map = new Map<string, string>();
    const items = staffQuery.data?.items;
    if (items) {
      for (const s of items) {
        map.set(s.id, s.display_name);
      }
    }
    return map;
  }, [staffQuery.data]);

  // ── Operators only (filtered to ops_operator role, no sales) ──
  const operators = useMemo(() => {
    const items = operatorsQuery.data?.items;
    if (!items) return [];
    return items.map(adaptStaff);
  }, [operatorsQuery.data]);

  // ── Fetch assignments for all leads ──
  const leadIds = useMemo(() => {
    const items = leadsQuery.data?.items;
    if (!items) return [];
    return items.map((l) => l.id);
  }, [leadsQuery.data]);

  const assignmentsQuery = useOpsLeadAssignments(leadIds);

  // ── Adapt API data to UI types ──
  const leads: Lead[] = useMemo(() => {
    const items = leadsQuery.data?.items;
    if (!items) return [];
    const assignmentsMap = assignmentsQuery.data;
    return items
      .filter((api) => !TERMINAL_STATUSES.has(api.status))
      .map((api) => adaptLead(api, staffLookup, assignmentsMap?.get(api.id)));
  }, [leadsQuery.data, staffLookup, assignmentsQuery.data]);

  const deviceNodes = useMemo(() => {
    const items = locationsQuery.data?.items;
    if (!items) return [];
    return items
      .map(adaptLocation)
      .filter((n): n is NonNullable<typeof n> => n !== null);
  }, [locationsQuery.data]);

  // ── Local UI state ──
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [allocatingLead, setAllocatingLead] = useState<Lead | null>(null);

  // ── Map data ──
  const mapPins: DeploymentPin[] = useMemo(() => {
    // Allocation mode: show source hubs + target lead
    if (allocatingLead) {
      const pins: DeploymentPin[] = deviceNodes
        .filter((n) => n.city !== allocatingLead.city)
        .map((n) => ({
          id: `hub-${n.id}`,
          city: n.city,
          latitude: n.latitude,
          longitude: n.longitude,
          status: "source",
          quantity: n.available,
          pocName: `${n.city} Hub`,
        }));
      const lat = allocatingLead.lat ?? CITY_COORDS[allocatingLead.city]?.[0];
      const lng = allocatingLead.lng ?? CITY_COORDS[allocatingLead.city]?.[1];
      if (lat != null && lng != null) {
        pins.push({
          id: `target-${allocatingLead.id}`,
          city: allocatingLead.city,
          latitude: lat,
          longitude: lng,
          status: "target",
          quantity: allocatingLead.headcount,
          pocName: allocatingLead.site,
        });
      }
      return pins;
    }

    // Normal mode: hub pins + lead pins grouped by city
    // Hub pins (always visible — partner device locations)
    const hubPins: DeploymentPin[] = deviceNodes.map((n) => ({
      id: `hub-${n.id}`,
      city: n.city,
      latitude: n.latitude,
      longitude: n.longitude,
      status: "source",
      quantity: n.available,
      pocName: n.city,
    }));

    // Lead pins grouped by city
    const byCity = new Map<string, { leads: Lead[]; lat: number; lng: number }>();
    for (const l of leads) {
      const lat = l.lat ?? CITY_COORDS[l.city]?.[0];
      const lng = l.lng ?? CITY_COORDS[l.city]?.[1];
      if (lat == null || lng == null) continue;
      const key = l.city || `${lat},${lng}`;
      const existing = byCity.get(key);
      if (existing) {
        existing.leads.push(l);
      } else {
        byCity.set(key, { leads: [l], lat, lng });
      }
    }

    const leadPins = Array.from(byCity.entries()).map(([city, { leads: cityLeads, lat, lng }]) => {
      const stageOrder: LeadStage[] = ["Leads", "Pending Visit", "Pending Allocation", "Pending Shipment", "Pending Deployment"];
      let bestStage: LeadStage = cityLeads[0].stage;
      for (const l of cityLeads) {
        if (stageOrder.indexOf(l.stage) > stageOrder.indexOf(bestStage)) {
          bestStage = l.stage;
        }
      }
      const totalWorkers = cityLeads.reduce((sum, l) => sum + l.headcount, 0);
      const totalDevices = cityLeads.reduce((sum, l) => sum + (l.deviceCount ?? 0), 0);
      const names = cityLeads.map((l) => l.site).join(", ");

      return {
        id: cityLeads[0].id,
        city,
        latitude: lat,
        longitude: lng,
        status: STAGE_TO_MAP_STATUS[bestStage],
        quantity: totalDevices || totalWorkers,
        pocName: cityLeads.length === 1 ? names : `${city} (${cityLeads.length} sites)`,
      };
    });

    return [...hubPins, ...leadPins];
  }, [leads, allocatingLead, deviceNodes]);

  const mapTransit: TransitRow[] = useMemo(() => {
    if (allocatingLead) return [];
    return leads
      .filter((l) => l.stage === "Pending Shipment" && l.deploymentRegion)
      .map((l) => ({
        id: l.id,
        route: `${l.deploymentRegion} → ${l.city}`,
        eta: "",
        quantity: l.deploymentDeviceCount ?? 0,
        type: "Devices",
        status: "in_transit",
      }));
  }, [leads, allocatingLead]);

  // ── Handlers ──
  const handleAllocateConfirm = useCallback(
    (sourceCity: string, quantity: number) => {
      if (!allocatingLead) return;
      const sourceNode = deviceNodes.find((n) => n.city === sourceCity);
      if (sourceNode) {
        allocateLead.mutate({
          leadId: allocatingLead.id,
          source_location_id: sourceNode.id,
          operator_org_id: sourceNode.orgId ?? sourceNode.id,
          device_count: quantity,
        });
      }
      setAllocatingLead(null);
    },
    [allocatingLead, deviceNodes, allocateLead],
  );

  const handleStartAllocate = useCallback((lead: Lead) => {
    setAllocatingLead(lead);
    setSelectedLeadId(null);
  }, []);

  const selectedLead = selectedLeadId
    ? leads.find((l) => l.id === selectedLeadId) ?? null
    : null;

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden">
      <ResizablePanelGroup direction="vertical">
        {/* ── Top panel: Map ── */}
        <ResizablePanel defaultSize={40} minSize={15}>
          <div className="h-full overflow-hidden relative flex">
            <div className="flex-1 relative">
              <DeviceDeploymentMap
                pins={mapPins}
                transitLines={mapTransit}
                highlightId={allocatingLead ? null : selectedLeadId}
                onAllocateConfirm={allocatingLead ? handleAllocateConfirm : undefined}
              />

              {/* Allocation mode indicator */}
              {allocatingLead && (
                <div className="absolute top-3 left-3 z-[1000] bg-card/95 backdrop-blur-sm border border-border/50 px-3 py-2 max-w-[240px]">
                  <div className="text-[11px] font-semibold mb-0.5">
                    Allocating → {allocatingLead.site}
                  </div>
                  <div className="text-[10px] text-muted-foreground mb-2">
                    Click a blue hub on the map to send devices
                  </div>
                  <button
                    onClick={() => setAllocatingLead(null)}
                    className="w-full h-7 text-[10px] border border-border text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Lead info panel */}
              {selectedLead && !allocatingLead && (
                <div className="absolute bottom-3 right-2 z-[1000] w-[240px] bg-card/95 backdrop-blur-sm border border-border/50 max-h-[70vh] overflow-y-auto">
                  <div className="px-3 py-2 border-b border-border/30">
                    <div className="text-[12px] font-semibold leading-tight">{selectedLead.site}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{selectedLead.city}</div>
                  </div>
                  <div className="px-3 py-2 space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Stage</span>
                      <span className="font-medium text-right max-w-[140px]">
                        {STAGE_DISPLAY_LABEL[selectedLead.stage]}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Workers</span>
                      <span className="font-medium tabular-nums">{selectedLead.headcount}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Rep</span>
                      <span className="font-medium">{selectedLead.rep}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedLeadId(null)}
                    className="w-full text-[10px] text-muted-foreground hover:text-foreground py-1.5 border-t border-border/30 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
            <div className="w-[260px] shrink-0 overflow-y-auto border-l border-border">
              {showSettings ? (
                <div className="p-3">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">Settings</span>
                    <button
                      onClick={() => setShowSettings(false)}
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      &times; Close
                    </button>
                  </div>
                  <ChecklistEditor />
                </div>
              ) : (
                <UtilizationPanel />
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* ── Bottom panel: Kanban pipeline ── */}
        <ResizablePanel defaultSize={60} minSize={25}>
          <div className="h-full flex flex-col min-h-0">
            <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-border">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[11px] uppercase tracking-[0.12em] font-semibold text-foreground">
                  Sales → CS → Allocation → Ship → Deploy
                </h1>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {leads.length} active
                </span>
                {leadsQuery.isLoading && (
                  <span className="text-[10px] text-muted-foreground animate-pulse">Loading…</span>
                )}
              </div>
              <button
                onClick={() => setShowSettings((v) => !v)}
                className={`text-[10px] px-2 py-1 transition-colors ${
                  showSettings
                    ? "text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {showSettings ? "Close Settings" : "Settings"}
              </button>
            </div>

            <KanbanBoard
              leads={leads}
              operators={operators}
              isLoading={leadsQuery.isLoading}
              selectedLeadId={selectedLeadId}
              onSelectLead={setSelectedLeadId}
              onAccept={(id) => acceptLead.mutate(id)}
              onReject={(id) => rejectLead.mutate(id)}
              onAssignVerifier={(id, staffId, date) =>
                assignVerifier.mutate({ leadId: id, staff_id: staffId, scheduled_date: date })
              }
              onMarkVerified={(id) => verifyLead.mutate(id)}
              onAllocate={(leadId) => {
                const lead = leads.find((l) => l.id === leadId);
                if (lead) handleStartAllocate(lead);
              }}
              onAssignShipper={(id, staffId, date) =>
                assignShipper.mutate({ leadId: id, staff_id: staffId, scheduled_date: date })
              }
              onMarkDispatched={(id) => dispatchLead.mutate(id)}
              onMarkDelivered={(id) => deliverLead.mutate(id)}
              onAssignDeployer={(id, staffId, date, time) =>
                assignDeployer.mutate({ leadId: id, staff_id: staffId, scheduled_date: date, scheduled_time: time })
              }
              onConfirmDeploy={(id) => deployLead.mutate(id)}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
