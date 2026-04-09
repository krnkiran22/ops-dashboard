"use client";

/**
 * Sidebar summary: total devices on live factories vs devices still tied to
 * in-flight leads (not yet deployed). Replaces the old per-site timeline view.
 */

import { useMemo } from "react";
import { useOpsLeads } from "@/lib/queries/operations";
import { TERMINAL_STATUSES } from "@/components/ops/kanban/ops-kanban-data";

/** Sort not-yet-live leads: closest to deployment first. */
const PIPELINE_ORDER: Record<string, number> = {
  pending_deployment: 0,
  pending_shipment: 1,
  pending_allocation: 2,
  pending_visit: 3,
  accepted: 4,
  confirmed: 5,
  lead: 6,
  deferred: 7,
};

function statusSummaryLabel(status: string): string {
  switch (status) {
    case "pending_deployment":
      return "Deploying";
    case "pending_shipment":
      return "Shipment";
    case "pending_allocation":
      return "Allocation";
    case "pending_visit":
      return "Site visit";
    case "accepted":
      return "Customer success";
    case "confirmed":
    case "lead":
      return "Sales";
    case "deferred":
      return "Deferred";
    default:
      return status;
  }
}

export function UtilizationPanel() {
  const leadsQuery = useOpsLeads();

  const { deployedDevices, deployedFactories, outstanding, outstandingDevices, outstandingFactories } =
    useMemo(() => {
      const items = leadsQuery.data?.items ?? [];
      let deployedDevices = 0;
      let deployedFactories = 0;
      const outstanding: {
        id: string;
        site: string;
        city: string;
        devices: number;
        status: string;
      }[] = [];

      for (const l of items) {
        const n = l.device_count ?? 0;
        if (l.status === "deployed" && n > 0) {
          deployedDevices += n;
          deployedFactories += 1;
          continue;
        }
        if (TERMINAL_STATUSES.has(l.status)) continue;
        if (l.status === "deployed") continue;
        if (n <= 0) continue;
        outstanding.push({
          id: l.id,
          site: l.factory_name,
          city: l.city ?? "",
          devices: n,
          status: l.status,
        });
      }

      outstanding.sort(
        (a, b) => (PIPELINE_ORDER[a.status] ?? 99) - (PIPELINE_ORDER[b.status] ?? 99) || a.site.localeCompare(b.site),
      );

      const outstandingDevices = outstanding.reduce((s, r) => s + r.devices, 0);
      const outstandingFactories = outstanding.length;

      return {
        deployedDevices,
        deployedFactories,
        outstanding,
        outstandingDevices,
        outstandingFactories,
      };
    }, [leadsQuery.data?.items]);

  return (
    <div className="h-full flex flex-col border-l border-border bg-card">
      <div className="shrink-0 px-3 py-2 border-b border-border">
        <h2 className="text-[11px] uppercase tracking-[0.12em] font-semibold text-foreground">Utilization</h2>
        <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
          Live deployments vs devices still planned for factories not yet recording.
        </p>
      </div>

      <div className="shrink-0 px-3 py-2 border-b border-border/60 space-y-2 bg-muted/20">
        <div>
          <div className="text-[9px] uppercase tracking-wide font-semibold text-muted-foreground">Devices deployed</div>
          <div className="text-[13px] font-semibold tabular-nums text-foreground">
            {deployedDevices.toLocaleString()}{" "}
            <span className="text-[10px] font-normal text-muted-foreground">
              devices · {deployedFactories} {deployedFactories === 1 ? "factory" : "factories"} live
            </span>
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wide font-semibold text-muted-foreground">
            Not live yet (deficit vs deployed)
          </div>
          <div className="text-[13px] font-semibold tabular-nums text-foreground">
            {outstandingDevices.toLocaleString()}{" "}
            <span className="text-[10px] font-normal text-muted-foreground">
              devices · {outstandingFactories} {outstandingFactories === 1 ? "factory" : "factories"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        <div className="px-3 py-1.5 text-[9px] uppercase tracking-wide font-semibold text-muted-foreground border-b border-border/40">
          Factories still to go live
        </div>
        {outstanding.length === 0 && (
          <div className="flex items-center justify-center h-24 text-[10px] text-muted-foreground px-3 text-center">
            No pending device commitments — all tracked leads are live or have no device count.
          </div>
        )}
        {outstanding.map((row) => (
          <div key={row.id} className="px-3 py-2 border-b border-border/30 hover:bg-muted/10">
            <div className="text-[11px] font-medium truncate">{row.site}</div>
            <div className="flex items-baseline justify-between gap-2 mt-0.5">
              <span className="text-[10px] text-muted-foreground truncate">{row.city}</span>
              <span className="text-[10px] tabular-nums text-foreground shrink-0">{row.devices} devices</span>
            </div>
            <div className="text-[9px] text-muted-foreground mt-0.5">{statusSummaryLabel(row.status)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
