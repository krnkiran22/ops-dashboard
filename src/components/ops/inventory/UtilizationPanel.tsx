"use client";

/**
 * Compact utilization list — sorted by urgency (soonest-to-free first).
 * Each row answers: where, how many, when free, what's next.
 *
 * Derives active deployments from leads with status 'deployed'
 * that have planned_start and planned_end dates.
 */

import { useMemo, useState } from "react";
import { useOpsLeads } from "@/lib/queries/operations";

interface ActiveDeployment {
  id: string;
  site: string;
  city: string;
  devices: number;
  duration: number;
  daysElapsed: number;
}

function urgencyColor(daysLeft: number) {
  if (daysLeft <= 3) return "bg-red-500";
  if (daysLeft <= 7) return "bg-yellow-500";
  return "bg-green-500";
}

function urgencyText(daysLeft: number) {
  if (daysLeft <= 3) return "text-red-600 dark:text-red-400";
  if (daysLeft <= 7) return "text-yellow-600 dark:text-yellow-400";
  return "text-muted-foreground";
}

export function UtilizationPanel() {
  const leadsQuery = useOpsLeads();
  const [now] = useState(() => Date.now());

  const active: ActiveDeployment[] = useMemo(() => {
    const items = leadsQuery.data?.items;
    if (!items) return [];

    return items
      .filter((l) => l.status === "deployed" && l.planned_start && l.planned_end)
      .map((l) => {
        const start = new Date(l.planned_start!).getTime();
        const end = new Date(l.planned_end!).getTime();
        const durationDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
        const elapsed = Math.max(0, Math.ceil((now - start) / (1000 * 60 * 60 * 24)));
        return {
          id: l.id,
          site: l.factory_name,
          city: l.city ?? "",
          devices: l.device_count ?? 0,
          duration: durationDays,
          daysElapsed: Math.min(elapsed, durationDays),
        };
      });
  }, [leadsQuery.data, now]);

  const sorted = useMemo(
    () => [...active].sort((a, b) => (a.duration - a.daysElapsed) - (b.duration - b.daysElapsed)),
    [active],
  );

  return (
    <div className="h-full flex flex-col border-l border-border bg-card">
      <div className="shrink-0 px-3 py-2 border-b border-border">
        <h2 className="text-[11px] uppercase tracking-[0.12em] font-semibold text-foreground">
          Utilization
        </h2>
        <div className="text-[10px] text-muted-foreground">
          {sorted.length} active · {sorted.reduce((s, d) => s + d.devices, 0)} devices
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {sorted.length === 0 && (
          <div className="flex items-center justify-center h-24 text-[10px] text-muted-foreground">
            No active deployments
          </div>
        )}

        {sorted.map((d) => {
          const daysLeft = d.duration - d.daysElapsed;
          const pct = Math.round((d.daysElapsed / d.duration) * 100);

          return (
            <div
              key={d.id}
              className="px-3 py-2 border-b border-border/30 hover:bg-muted/10 cursor-pointer"
            >
              <div className="text-[11px] font-medium truncate mb-1">{d.site}</div>

              <div className="h-[3px] bg-muted mb-1">
                <div
                  className={`h-full ${urgencyColor(daysLeft)}`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="flex items-baseline justify-between mb-0.5">
                <span className={`text-[10px] tabular-nums font-semibold ${urgencyText(daysLeft)}`}>
                  {daysLeft}d left
                </span>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {d.devices} devices · {d.daysElapsed}/{d.duration}d
                </span>
              </div>

              <div className="flex items-baseline justify-between">
                <span className="text-[10px] text-muted-foreground">{d.city}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
