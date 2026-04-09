"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Lead, Operator, VisitRole } from "./ops-kanban-data";
import {
  visitHasSiteVisitor,
  visitCanAddSecondary,
  visitRolesStillNeeded,
  canConfirmDeploymentComplete,
  isManualLead,
} from "./ops-kanban-data";

const STAGE_ACCENT: Record<Lead["stage"], string> = {
  Sales: "bg-yellow-500",
  "Customer Success": "bg-orange-500",
  Allocation: "bg-blue-500",
  Shipment: "bg-violet-500",
  Deployment: "bg-emerald-600",
};

interface Props {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: Operator[];
  onAccept?: () => void;
  onReject?: () => void;
  onAssignVisitPrimary?: (staffId: string, date: string, role: VisitRole) => void;
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
 * Full lead detail with contextual actions aligned to the five-column pipeline.
 */
export function LeadDetailDialog({
  lead,
  open,
  onOpenChange,
  staff,
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
}: Props) {
  const [staffDraft, setStaffDraft] = useState({ op: "", date: "", time: "" });
  const [showAssignForm, setShowAssignForm] = useState<"visit" | null>(null);
  const [visitSlot, setVisitSlot] = useState<"primary" | "secondary">("primary");
  const [visitRole, setVisitRole] = useState<VisitRole>("customer_success");
  const [visitAllowedRoles, setVisitAllowedRoles] = useState<VisitRole[]>(["customer_success", "chief_operator"]);

  const todayStr = new Date().toISOString().split("T")[0];

  const resetForm = () => {
    setStaffDraft({ op: "", date: "", time: "" });
    setShowAssignForm(null);
  };

  const canPrimaryVisit = !lead.verifierStaffId;
  const canSecondaryVisit = visitCanAddSecondary(lead);
  const stillNeeded = visitRolesStillNeeded(lead);
  const showAddFirstVisitor = canPrimaryVisit;
  const showAddSecondVisitor = canSecondaryVisit && stillNeeded.length > 0;
  const manual = isManualLead(lead);

  const openVisit = (slot: "primary" | "secondary") => {
    const needed = visitRolesStillNeeded(lead);
    const allowedRoles: VisitRole[] =
      slot === "primary" && !visitHasSiteVisitor(lead)
        ? ["customer_success", "chief_operator"]
        : needed;
    if (allowedRoles.length === 0) return;
    const role = allowedRoles.includes("customer_success") ? "customer_success" : allowedRoles[0];
    setVisitSlot(slot);
    setVisitRole(role);
    setVisitAllowedRoles(allowedRoles);
    setShowAssignForm("visit");
    setStaffDraft((d) => ({ ...d, op: "", date: "" }));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <div className={`h-[2px] -mx-4 -mt-4 mb-2 ${STAGE_ACCENT[lead.stage]}`} />

        <DialogHeader>
          <DialogTitle>{lead.site}</DialogTitle>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[11px] text-muted-foreground">{lead.city}</span>
            <span className="text-[9px] uppercase tracking-wide font-semibold text-muted-foreground px-1.5 py-0.5 bg-muted">
              {lead.stage}
              {lead.stage === "Deployment" && lead.status === "deployed" ? " · Live" : ""}
              {lead.stage === "Deployment" && lead.status === "pending_deployment" ? " · Pending" : ""}
            </span>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 py-3 border-y border-border">
          <Metric label="Workers" value={String(lead.headcount)} />
          <Metric label="Duration" value={`${lead.duration} days`} />
          <Metric label="Rep" value={lead.rep} />
        </div>

        <div className="space-y-1 py-2">
          {lead.industry && <Row label="Industry" value={lead.industry} />}
          {lead.shifts != null && <Row label="Shifts" value={String(lead.shifts)} />}
          {lead.workersPerShift != null && <Row label="Workers/Shift" value={String(lead.workersPerShift)} />}
          {lead.address && <Row label="Address" value={lead.address} />}
          {lead.contactName && <Row label="POC" value={lead.contactName} />}
          {lead.contactPhone && <Row label="Phone" value={lead.contactPhone} />}
          {lead.plannedStart && <Row label="Start" value={lead.plannedStart} />}
          {lead.plannedEnd && <Row label="End" value={lead.plannedEnd} />}
        </div>

        {visitHasSiteVisitor(lead) && lead.stage !== "Sales" && (
          <div className="space-y-1 pt-2 border-t border-border/50">
            <SectionLabel>Site visit</SectionLabel>
            {lead.verifierStaffId && (
              <Row
                label={
                  lead.visitVerifierRole === "customer_success"
                    ? "CS"
                    : lead.visitVerifierRole === "chief_operator"
                      ? "Chief"
                      : "Visit"
                }
                value={`${lead.verifier ?? ""}${lead.visitDate ? ` · ${lead.visitDate}` : ""}`}
              />
            )}
            {lead.visitSecondaryStaffId && (
              <Row
                label={
                  lead.visitSecondaryRole === "customer_success"
                    ? "CS"
                    : lead.visitSecondaryRole === "chief_operator"
                      ? "Chief"
                      : "Visit"
                }
                value={`${lead.visitSecondaryName ?? ""}${lead.visitSecondaryDate ? ` · ${lead.visitSecondaryDate}` : ""}`}
              />
            )}
          </div>
        )}

        {lead.deploymentDeviceCount != null && (
          <div className="space-y-1 pt-2 border-t border-border/50">
            <SectionLabel>Devices</SectionLabel>
            {lead.deploymentRegion && <Row label="Region" value={lead.deploymentRegion} />}
            <Row label="Count" value={String(lead.deploymentDeviceCount)} />
          </div>
        )}

        {lead.stage === "Shipment" && (lead.shipmentCarrier || lead.shipmentExpectedDelivery) && (
          <div className="space-y-1 pt-2 border-t border-border/50">
            <SectionLabel>Logistics</SectionLabel>
            {lead.shipmentExpectedDelivery && <Row label="ETA" value={lead.shipmentExpectedDelivery} />}
            {lead.shipmentCarrier && <Row label="Carrier" value={lead.shipmentCarrier} />}
            {lead.shipmentTracking && <Row label="Tracking" value={lead.shipmentTracking} />}
          </div>
        )}

        {(lead.deployer || lead.deploymentCrew.length > 0) && (
          <div className="space-y-1 pt-2 border-t border-border/50">
            <SectionLabel>Deployment</SectionLabel>
            {lead.deploymentCrew.map((c) => (
              <Row key={`${c.staffId}-${c.role}`} label={c.role === "chief_operator" ? "Chief" : "Operator"} value={c.name} />
            ))}
            {lead.deploymentCrew.length === 0 && lead.deployer && (
              <>
                <Row label="Deployer" value={lead.deployer} />
                <Row label="Date" value={lead.deployDate ?? "—"} />
                <Row label="Time" value={lead.deployTime ?? "—"} />
              </>
            )}
          </div>
        )}

        {lead.notes && (
          <div className="pt-2 border-t border-border/50">
            <SectionLabel>Notes</SectionLabel>
            <div className="text-[11px] leading-relaxed mt-1">{lead.notes}</div>
          </div>
        )}

        <div className="pt-3 border-t border-border space-y-2">
          {manual && (
            <>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Local-only entry in this browser — not synced to the server.
              </p>
              {onRemoveManual && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="w-full h-8 text-[11px]"
                  onClick={() => {
                    if (window.confirm(`Remove "${lead.site}" from this board?`)) {
                      onRemoveManual();
                      onOpenChange(false);
                    }
                  }}
                >
                  Remove from board
                </Button>
              )}
            </>
          )}
          {!manual && lead.stage === "Sales" && (lead.status === "lead" || lead.status === "confirmed") && (
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 h-8 text-[11px]" onClick={() => { onAccept?.(); onOpenChange(false); }}>
                Accept
              </Button>
              <Button size="sm" variant="destructive" className="h-8 text-[11px]" onClick={() => {
                if (window.confirm(`Reject "${lead.site}"?`)) { onReject?.(); onOpenChange(false); }
              }}>
                Reject
              </Button>
            </div>
          )}

          {!manual && lead.stage === "Customer Success" && !showAssignForm && (
            <>
              {!visitHasSiteVisitor(lead) && showAddFirstVisitor && (
                <div className="flex flex-col gap-2">
                  <span className="text-[9px] uppercase tracking-wide text-muted-foreground font-semibold">
                    Schedule site visit
                  </span>
                  <Button size="sm" variant="outline" className="h-8 text-[11px] w-full" onClick={() => openVisit("primary")}>
                    Add site visitor
                  </Button>
                </div>
              )}
              {visitHasSiteVisitor(lead) && (
                <>
                  {showAddSecondVisitor && (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => openVisit("secondary")}>
                        Add second visitor
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 h-8 text-[11px]" onClick={() => { onMarkVerified?.(); onOpenChange(false); }}>
                      Mark verified
                    </Button>
                    <Button size="sm" variant="destructive" className="h-8 text-[11px]" onClick={() => {
                      if (window.confirm(`Reject "${lead.site}"?`)) { onReject?.(); onOpenChange(false); }
                    }}>
                      Reject
                    </Button>
                  </div>
                </>
              )}
            </>
          )}

          {!manual && lead.stage === "Allocation" && (
            <Button size="sm" className="w-full h-8 text-[11px]" onClick={() => { onAllocate?.(); onOpenChange(false); }}>
              Allocate devices
            </Button>
          )}

          {!manual && lead.stage === "Shipment" && lead.status === "pending_shipment" && (
            <>
              <Button size="sm" variant="secondary" className="w-full h-8 text-[11px]" onClick={() => { onOpenShipmentDetails?.(); }}>
                Shipment & logistics details
              </Button>
              {!showAssignForm && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 h-8 text-[11px]" onClick={() => { onMarkDispatched?.(); }}>
                    Dispatched
                  </Button>
                  <Button size="sm" className="flex-1 h-8 text-[11px]" onClick={() => { onMarkDelivered?.(); onOpenChange(false); }}>
                    Delivered
                  </Button>
                </div>
              )}
            </>
          )}

          {!manual && lead.stage === "Deployment" && lead.status === "pending_deployment" && (
            <>
              <Button size="sm" variant="outline" className="w-full h-8 text-[11px]" onClick={() => { onOpenDeploymentPrep?.(); }}>
                Plan deployment crew
              </Button>
              <Button
                size="sm"
                className="w-full h-8 text-[11px]"
                disabled={!canConfirmDeploymentComplete(lead)}
                title={
                  canConfirmDeploymentComplete(lead)
                    ? undefined
                    : "Plan deployment crew before marking deployed"
                }
                onClick={() => {
                  if (window.confirm(`Confirm deployment for "${lead.site}"?`)) { onConfirmDeploy?.(); onOpenChange(false); }
                }}
              >
                Confirm deployed
              </Button>
            </>
          )}

          {!manual && showAssignForm === "visit" && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <SectionLabel>{visitSlot === "primary" ? "Primary visit" : "Additional visitor"}</SectionLabel>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Role</div>
              <select
                value={visitRole}
                onChange={(e) => {
                  const r = e.target.value as VisitRole;
                  if (visitAllowedRoles.includes(r)) setVisitRole(r);
                }}
                className="w-full h-8 text-[11px] border border-input bg-transparent px-2 outline-none"
              >
                {visitAllowedRoles.map((r) => (
                  <option key={r} value={r}>
                    {r === "customer_success" ? "Customer Success" : "Chief operator"}
                  </option>
                ))}
              </select>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Staff</div>
              <select
                value={staffDraft.op}
                onChange={(e) => setStaffDraft((d) => ({ ...d, op: e.target.value }))}
                className="w-full h-8 text-[11px] border border-input bg-transparent px-2 outline-none"
              >
                <option value="">Select staff…</option>
                {staff.map((op) => (
                  <option key={op.id} value={op.id}>{op.name}</option>
                ))}
              </select>
              <input
                type="date"
                value={staffDraft.date}
                min={todayStr}
                onChange={(e) => setStaffDraft((d) => ({ ...d, date: e.target.value }))}
                className="w-full h-8 text-[11px] border border-input bg-transparent px-2 outline-none"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 h-8 text-[11px]"
                  disabled={!staffDraft.op || !staffDraft.date}
                  onClick={() => {
                    if (visitSlot === "primary") {
                      onAssignVisitPrimary?.(staffDraft.op, staffDraft.date, visitRole);
                    } else {
                      onAssignVisitSecondary?.(staffDraft.op, staffDraft.date, visitRole);
                    }
                    resetForm();
                    onOpenChange(false);
                  }}
                >
                  Save
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-[11px]" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-[13px] font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
      {children}
    </div>
  );
}
