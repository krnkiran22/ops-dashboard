"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Lead, Operator } from "./ops-kanban-data";

const TRIAGE_BADGE_STYLE: Record<string, string> = {
  New: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  Confirmed: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  Accepted: "bg-green-500/15 text-green-700 dark:text-green-400",
  Deferred: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  Rejected: "bg-red-500/12 text-red-600 dark:text-red-400",
  Cancelled: "bg-muted text-muted-foreground",
};

function stop(e: React.MouseEvent) {
  e.stopPropagation();
}

interface LeadCardProps {
  lead: Lead;
  selected?: boolean;
  onSelect?: () => void;
  isDragging?: boolean;
  operators?: Operator[];
  onAccept?: () => void;
  onReject?: () => void;
  onAssignVerifier?: (staffId: string, date: string) => void;
  onMarkVerified?: () => void;
  onAllocate?: () => void;
  onAssignShipper?: (staffId: string, date: string) => void;
  onMarkDispatched?: () => void;
  onMarkDelivered?: () => void;
  onAssignDeployer?: (staffId: string, date: string, time: string) => void;
  onConfirmDeploy?: () => void;
}

/**
 * Pipeline card — shows lead summary, stage context, and inline action
 * buttons. Full details available in LeadDetailDialog on click.
 */
export function LeadCard({
  lead,
  selected,
  onSelect,
  isDragging,
  operators = [],
  onAccept,
  onReject,
  onAssignVerifier,
  onMarkVerified,
  onAllocate,
  onAssignShipper,
  onMarkDispatched,
  onMarkDelivered,
  onAssignDeployer,
  onConfirmDeploy,
}: LeadCardProps) {
  const [showForm, setShowForm] = useState<"verifier" | "shipper" | "deployer" | null>(null);
  const [draft, setDraft] = useState({ op: "", date: "", time: "" });
  const todayStr = new Date().toISOString().split("T")[0];

  const resetForm = () => { setDraft({ op: "", date: "", time: "" }); setShowForm(null); };

  return (
    <div
      className={`border bg-card p-3 transition-colors cursor-pointer ${
        isDragging
          ? "opacity-40 border-foreground/30"
          : selected
            ? "border-foreground/40 bg-accent/20"
            : "border-border hover:border-foreground/20"
      }`}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-0.5">
        <div className="text-[12px] font-medium leading-tight truncate">
          {lead.site}
        </div>
        {lead.triageBadge && (
          <span
            className={`shrink-0 inline-block px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
              TRIAGE_BADGE_STYLE[lead.triageBadge] ?? "bg-muted text-muted-foreground"
            }`}
          >
            {lead.triageBadge}
          </span>
        )}
      </div>

      <div className="text-[11px] text-muted-foreground leading-snug">
        {lead.city} · {lead.headcount} workers · {lead.duration}d
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">
        {lead.rep}
      </div>

      {/* Stage-specific context — CS: verify claimed headcount vs. real deployment potential */}
      {lead.stage === "Pending Visit" && lead.status === "accepted" && !lead.verifier && (
        <div className="mt-1.5 pt-1.5 border-t border-border/30 text-[9px] text-muted-foreground leading-snug">
          Assign an operator to visit the factory and validate workforce / deployment potential.
        </div>
      )}
      {lead.stage === "Pending Visit" && lead.verifier && (
        <div className="mt-1.5 pt-1.5 border-t border-border/30 text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground">{lead.verifier}</span>
          {lead.visitDate && <> · {lead.visitDate}</>}
        </div>
      )}

      {lead.stage === "Pending Shipment" && (
        <div className="mt-1.5 pt-1.5 border-t border-border/30 text-[10px] text-muted-foreground">
          {lead.deploymentDeviceCount} devices
          {lead.deploymentRegion ? ` · ${lead.deploymentRegion}` : ""} → {lead.city}
          {lead.shipper && (
            <div className="mt-0.5">
              <span className="font-medium text-foreground">{lead.shipper}</span>
            </div>
          )}
        </div>
      )}

      {lead.stage === "Pending Deployment" && (
        <div className="mt-1.5 pt-1.5 border-t border-border/30 text-[10px] text-muted-foreground">
          {lead.deploymentDeviceCount} devices → {lead.city}
          {lead.deployer && (
            <div className="mt-0.5">
              <span className="font-medium text-foreground">{lead.deployer}</span>
              {lead.deployDate && <> · {lead.deployDate}</>}
              {lead.deployTime && <> {lead.deployTime}</>}
            </div>
          )}
        </div>
      )}

      {/* ── Inline actions ── */}
      <div className="mt-2" onClick={stop}>
        {/* Leads: accept/reject */}
        {lead.stage === "Leads" && (lead.status === "lead" || lead.status === "confirmed") && (
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="flex-1 h-7 text-[11px]" onClick={onAccept}>
              Accept
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-[11px] text-destructive" onClick={() => {
              if (window.confirm(`Reject "${lead.site}"?`)) onReject?.();
            }}>
              Reject
            </Button>
          </div>
        )}

        {/* Pending Visit (CS): verify on-site potential */}
        {lead.stage === "Pending Visit" && lead.verifier && !showForm && (
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="flex-1 h-7 text-[11px]" onClick={onMarkVerified}>
              Mark verified
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-[11px] text-destructive" onClick={() => {
              if (window.confirm(`Reject "${lead.site}"?`)) onReject?.();
            }}>
              Reject
            </Button>
          </div>
        )}

        {/* Pending Visit (CS): assign operator for site check */}
        {lead.stage === "Pending Visit" && !lead.verifier && !showForm && (
          <Button size="sm" variant="outline" className="w-full h-7 text-[11px]" onClick={() => setShowForm("verifier")}>
            Assign CS operator
          </Button>
        )}

        {/* Pending Allocation: map-based allocation + reject */}
        {lead.stage === "Pending Allocation" && !showForm && (
          <div className="space-y-1.5">
            <p className="text-[9px] text-muted-foreground leading-snug">
              Opens allocation on the map — pick a hub, then confirm device count.
            </p>
            <Button size="sm" className="w-full h-7 text-[11px]" onClick={onAllocate}>
              Allocate devices…
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="w-full h-7 text-[11px] text-destructive hover:text-destructive"
              onClick={() => {
                if (window.confirm(`Reject "${lead.site}"?`)) onReject?.();
              }}
            >
              Reject
            </Button>
          </div>
        )}

        {/* Pending Shipment */}
        {lead.stage === "Pending Shipment" && !lead.shipper && !showForm && (
          <Button size="sm" variant="outline" className="w-full h-7 text-[11px]" onClick={() => setShowForm("shipper")}>
            Assign Shipper
          </Button>
        )}
        {lead.stage === "Pending Shipment" && lead.shipper && (
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="flex-1 h-7 text-[11px]" onClick={onMarkDispatched}>
              Dispatched
            </Button>
            <Button size="sm" variant="outline" className="flex-1 h-7 text-[11px]" onClick={onMarkDelivered}>
              Delivered
            </Button>
          </div>
        )}

        {/* Pending Deployment */}
        {lead.stage === "Pending Deployment" && !lead.deployer && !showForm && (
          <Button size="sm" variant="outline" className="w-full h-7 text-[11px]" onClick={() => setShowForm("deployer")}>
            Assign deployment ops
          </Button>
        )}
        {lead.stage === "Pending Deployment" && lead.deployer && (
          <Button size="sm" variant="outline" className="w-full h-7 text-[11px]" onClick={() => {
            if (window.confirm(`Confirm deployment for "${lead.site}"?`)) onConfirmDeploy?.();
          }}>
            Confirm Deploy
          </Button>
        )}

        {/* Inline assignment form */}
        {showForm && (
          <div className="space-y-1.5 pt-1.5 border-t border-border/30 mt-1.5">
            <select
              value={draft.op}
              onChange={(e) => setDraft((d) => ({ ...d, op: e.target.value }))}
              className="w-full h-7 text-[11px] border border-input bg-transparent px-2 outline-none"
            >
              <option value="">Select ops operator…</option>
              {operators.map((op) => (
                <option key={op.id} value={op.id}>{op.name}</option>
              ))}
            </select>
            <input
              type="date"
              value={draft.date}
              min={todayStr}
              onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
              className="w-full h-7 text-[11px] border border-input bg-transparent px-2 outline-none"
            />
            {showForm === "deployer" && (
              <input
                type="time"
                value={draft.time}
                onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))}
                className="w-full h-7 text-[11px] border border-input bg-transparent px-2 outline-none"
              />
            )}
            <div className="flex gap-1.5">
              <Button
                size="sm"
                className="flex-1 h-7 text-[11px]"
                disabled={!draft.op || !draft.date || (showForm === "deployer" && !draft.time)}
                onClick={() => {
                  if (showForm === "verifier") onAssignVerifier?.(draft.op, draft.date);
                  else if (showForm === "shipper") onAssignShipper?.(draft.op, draft.date);
                  else onAssignDeployer?.(draft.op, draft.date, draft.time);
                  resetForm();
                }}
              >
                Confirm
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
