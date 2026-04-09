"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Lead, Operator, VisitRole } from "./ops-kanban-data";
import {
  visitHasSiteVisitor,
  visitCanAddSecondary,
  visitRolesStillNeeded,
  canConfirmDeploymentComplete,
  isManualLead,
} from "./ops-kanban-data";

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

interface VisitFormState {
  slot: "primary" | "secondary";
  role: VisitRole;
  /** Roles the user may pick in the dropdown (second visitor excludes roles already covered). */
  allowedRoles: VisitRole[];
}

interface LeadCardProps {
  lead: Lead;
  selected?: boolean;
  onSelect?: () => void;
  isDragging?: boolean;
  staff?: Operator[];
  onAccept?: () => void;
  onReject?: () => void;
  /** First site visitor — creates verifier assignment + metadata role. */
  onAssignVisitPrimary?: (staffId: string, date: string, role: VisitRole) => void;
  /** Second visitor — metadata only. */
  onAssignVisitSecondary?: (staffId: string, date: string, role: VisitRole) => void;
  onMarkVerified?: () => void;
  onAllocate?: () => void;
  onMarkDispatched?: () => void;
  onMarkDelivered?: () => void;
  onOpenShipmentDetails?: () => void;
  onOpenDeploymentPrep?: () => void;
  onConfirmDeploy?: () => void;
  onRemoveManual?: () => void;
}

/**
 * Pipeline card — five-column flow (Sales → CS → Allocation → Shipment → Deployment).
 */
export function LeadCard({
  lead,
  selected,
  onSelect,
  isDragging,
  staff = [],
  onAccept,
  onReject,
  onAssignVisitPrimary,
  onAssignVisitSecondary,
  onMarkVerified,
  onAllocate,
  onMarkDispatched,
  onMarkDelivered,
  onOpenShipmentDetails,
  onOpenDeploymentPrep,
  onConfirmDeploy,
  onRemoveManual,
}: LeadCardProps) {
  const [showForm, setShowForm] = useState<"visit" | null>(null);
  const [visitForm, setVisitForm] = useState<VisitFormState | null>(null);
  const [draft, setDraft] = useState({ op: "", date: "", time: "" });
  const todayStr = new Date().toISOString().split("T")[0];

  const resetForm = () => {
    setDraft({ op: "", date: "", time: "" });
    setShowForm(null);
    setVisitForm(null);
  };

  const openVisitForm = (slot: "primary" | "secondary") => {
    const needed = visitRolesStillNeeded(lead);
    const allowedRoles: VisitRole[] =
      slot === "primary" && !visitHasSiteVisitor(lead)
        ? ["customer_success", "chief_operator"]
        : needed;
    if (allowedRoles.length === 0) return;
    const role = allowedRoles.includes("customer_success") ? "customer_success" : allowedRoles[0];
    setVisitForm({ slot, role, allowedRoles });
    setShowForm("visit");
    setDraft((d) => ({ ...d, op: "", date: "" }));
  };

  const canPrimaryVisit = !lead.verifierStaffId;
  const canSecondaryVisit = visitCanAddSecondary(lead);
  const stillNeeded = visitRolesStillNeeded(lead);
  const showAddFirstVisitor = canPrimaryVisit;
  const showAddSecondVisitor = canSecondaryVisit && stillNeeded.length > 0;
  const manual = isManualLead(lead);

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
      <div className="flex items-start justify-between gap-2 mb-0.5">
        <div className="text-[12px] font-medium leading-tight truncate">
          {lead.site}
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          {lead.stage === "Deployment" && (
            <span
              className={`inline-block px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide ${
                lead.status === "deployed"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : "bg-amber-500/15 text-amber-800 dark:text-amber-300"
              }`}
            >
              {lead.status === "deployed" ? "Live" : "Pending deploy"}
            </span>
          )}
          {lead.triageBadge && (
            <span
              className={`inline-block px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                TRIAGE_BADGE_STYLE[lead.triageBadge] ?? "bg-muted text-muted-foreground"
              }`}
            >
              {lead.triageBadge}
            </span>
          )}
        </div>
      </div>

      <div className="text-[11px] text-muted-foreground leading-snug">
        {lead.city} · {lead.headcount} workers · {lead.duration}d
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">
        {lead.rep}
      </div>

      {lead.stage === "Customer Success" && visitHasSiteVisitor(lead) && (
        <div className="mt-1.5 pt-1.5 border-t border-border/30 text-[10px] text-muted-foreground space-y-0.5">
          {lead.verifierStaffId && (
            <div>
              <span className="text-muted-foreground/80">
                {lead.visitVerifierRole === "customer_success"
                  ? "CS"
                  : lead.visitVerifierRole === "chief_operator"
                    ? "Chief"
                    : "Visit"}
                :{" "}
              </span>
              <span className="font-medium text-foreground">{lead.verifier}</span>
              {lead.visitDate && <> · {lead.visitDate}</>}
            </div>
          )}
          {lead.visitSecondaryStaffId && (
            <div>
              <span className="text-muted-foreground/80">
                {lead.visitSecondaryRole === "customer_success" ? "CS" : "Chief"}:{" "}
              </span>
              <span className="font-medium text-foreground">{lead.visitSecondaryName}</span>
              {lead.visitSecondaryDate && <> · {lead.visitSecondaryDate}</>}
            </div>
          )}
        </div>
      )}

      {lead.stage === "Shipment" && lead.status === "pending_shipment" && (
        <div className="mt-1.5 pt-1.5 border-t border-border/30 text-[10px] text-muted-foreground">
          {lead.deploymentDeviceCount} devices
          {lead.deploymentRegion ? ` · ${lead.deploymentRegion}` : ""} → {lead.city}
          {(lead.shipmentExpectedDelivery || lead.shipmentCarrier || lead.shipmentTracking) && (
            <div className="mt-1 text-[9px] space-y-0.5">
              {lead.shipmentExpectedDelivery && <div>ETA {lead.shipmentExpectedDelivery}</div>}
              {lead.shipmentCarrier && <div>{lead.shipmentCarrier}</div>}
              {lead.shipmentTracking && <div className="truncate">Ref {lead.shipmentTracking}</div>}
            </div>
          )}
        </div>
      )}

      {lead.stage === "Deployment" && lead.status === "pending_deployment" && (
        <div className="mt-1.5 pt-1.5 border-t border-border/30 text-[10px] text-muted-foreground">
          {lead.deploymentDeviceCount} devices → {lead.city}
          {lead.deploymentCrew.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {lead.deploymentCrew.map((c) => (
                <div key={`${c.staffId}-${c.role}`}>
                  <span className="text-muted-foreground/80">{c.role === "chief_operator" ? "Chief" : "Op"}: </span>
                  <span className="font-medium text-foreground">{c.name}</span>
                </div>
              ))}
            </div>
          )}
          {lead.deployer && lead.deploymentCrew.length === 0 && (
            <div className="mt-0.5">
              <span className="font-medium text-foreground">{lead.deployer}</span>
              {lead.deployDate && <> · {lead.deployDate}</>}
              {lead.deployTime && <> {lead.deployTime}</>}
            </div>
          )}
        </div>
      )}

      {lead.stage === "Deployment" && lead.status === "deployed" && (
        <div className="mt-1.5 pt-1.5 border-t border-border/30 text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
          Recording live at factory
        </div>
      )}

      <div className="mt-2 space-y-1.5" onClick={stop}>
        {manual && (
          <div className="rounded border border-dashed border-border/70 bg-muted/20 px-2 py-1.5 space-y-1.5">
            <p className="text-[9px] text-muted-foreground leading-snug">
              Local-only — not synced to the server. Cleared if you clear site data.
            </p>
            {onRemoveManual && (
              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 text-[10px] text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => {
                  if (window.confirm(`Remove "${lead.site}" from this board?`)) onRemoveManual();
                }}
              >
                Remove from board
              </Button>
            )}
          </div>
        )}
        {!manual && lead.stage === "Sales" && (lead.status === "lead" || lead.status === "confirmed") && (
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="flex-1 h-7 text-[11px]" onClick={onAccept}>
              Accept
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px] text-destructive"
              onClick={() => {
                if (window.confirm(`Reject "${lead.site}"?`)) onReject?.();
              }}
            >
              Reject
            </Button>
          </div>
        )}

        {!manual && lead.stage === "Customer Success" && !showForm && (
          <>
            {!visitHasSiteVisitor(lead) && showAddFirstVisitor && (
              <div className="flex flex-col gap-1">
                <span className="text-[9px] uppercase tracking-wide text-muted-foreground font-semibold">
                  Schedule site visit
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] px-2 w-full"
                  onClick={() => openVisitForm("primary")}
                >
                  Add site visitor
                </Button>
              </div>
            )}
            {visitHasSiteVisitor(lead) && (
              <>
                {showAddSecondVisitor && (
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] px-2"
                      onClick={() => openVisitForm("secondary")}
                    >
                      Add second visitor
                    </Button>
                  </div>
                )}
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-[11px]" onClick={onMarkVerified}>
                    Mark verified
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px] text-destructive"
                    onClick={() => {
                      if (window.confirm(`Reject "${lead.site}"?`)) onReject?.();
                    }}
                  >
                    Reject
                  </Button>
                </div>
              </>
            )}
          </>
        )}

        {!manual && lead.stage === "Allocation" && (
          <Button size="sm" className="w-full h-7 text-[11px]" onClick={onAllocate}>
            Allocate devices
          </Button>
        )}

        {!manual && lead.stage === "Shipment" && lead.status === "pending_shipment" && (
          <>
            <Button
              size="sm"
              variant="secondary"
              className="w-full h-7 text-[11px]"
              onClick={onOpenShipmentDetails}
            >
              Shipment & logistics details
            </Button>
            {!showForm && (
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" className="flex-1 h-7 text-[11px]" onClick={onMarkDispatched}>
                  Dispatched
                </Button>
                <Button size="sm" variant="outline" className="flex-1 h-7 text-[11px]" onClick={onMarkDelivered}>
                  Delivered
                </Button>
              </div>
            )}
          </>
        )}

        {!manual && lead.stage === "Deployment" && lead.status === "pending_deployment" && (
          <>
            <Button size="sm" variant="outline" className="w-full h-7 text-[11px]" onClick={onOpenDeploymentPrep}>
              Plan deployment crew
            </Button>
            <Button
              size="sm"
              className="w-full h-7 text-[11px]"
              disabled={!canConfirmDeploymentComplete(lead)}
              title={
                canConfirmDeploymentComplete(lead)
                  ? undefined
                  : "Plan deployment crew before marking deployed"
              }
              onClick={() => {
                if (window.confirm(`Confirm deployment complete for "${lead.site}"?`)) onConfirmDeploy?.();
              }}
            >
              Confirm deployed
            </Button>
          </>
        )}

        {!manual && showForm === "visit" && visitForm && (
          <div className="space-y-1.5 pt-1.5 border-t border-border/30 mt-1.5">
            <div className="text-[10px] font-semibold text-muted-foreground">
              {visitForm.slot === "primary" ? "Primary visit" : "Additional visitor"}
            </div>
            <label className="block text-[9px] uppercase tracking-wide text-muted-foreground font-semibold">
              Role
            </label>
            <select
              value={visitForm.role}
              onChange={(e) =>
                setVisitForm((vf) =>
                  vf && vf.allowedRoles.includes(e.target.value as VisitRole)
                    ? { ...vf, role: e.target.value as VisitRole }
                    : vf,
                )
              }
              className="w-full h-7 text-[11px] border border-input bg-transparent px-2 outline-none"
            >
              {visitForm.allowedRoles.map((r) => (
                <option key={r} value={r}>
                  {r === "customer_success" ? "Customer Success" : "Chief operator"}
                </option>
              ))}
            </select>
            <label className="block text-[9px] uppercase tracking-wide text-muted-foreground font-semibold">
              Staff
            </label>
            <select
              value={draft.op}
              onChange={(e) => setDraft((d) => ({ ...d, op: e.target.value }))}
              className="w-full h-7 text-[11px] border border-input bg-transparent px-2 outline-none"
            >
              <option value="">Select staff…</option>
              {staff.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={draft.date}
              min={todayStr}
              onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
              className="w-full h-7 text-[11px] border border-input bg-transparent px-2 outline-none"
            />
            <div className="flex gap-1.5">
              <Button
                size="sm"
                className="flex-1 h-7 text-[11px]"
                disabled={!draft.op || !draft.date}
                onClick={() => {
                  if (visitForm.slot === "primary") {
                    onAssignVisitPrimary?.(draft.op, draft.date, visitForm.role);
                  } else {
                    onAssignVisitSecondary?.(draft.op, draft.date, visitForm.role);
                  }
                  resetForm();
                }}
              >
                Save
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
