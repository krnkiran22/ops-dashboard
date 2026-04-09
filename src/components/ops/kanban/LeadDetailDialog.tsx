"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { STAGE_DISPLAY_LABEL, type Lead, type Operator } from "./ops-kanban-data";

const STAGE_ACCENT: Record<Lead["stage"], string> = {
  Leads: "bg-yellow-500",
  "Pending Visit": "bg-orange-500",
  "Pending Allocation": "bg-blue-500",
  "Pending Shipment": "bg-violet-500",
  "Pending Deployment": "bg-green-500",
};

interface Props {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operators: Operator[];
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
 * Full detail dialog for a pipeline lead — shows all info plus
 * contextual action buttons for the current stage.
 */
export function LeadDetailDialog({
  lead,
  open,
  onOpenChange,
  operators,
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
}: Props) {
  const [staffDraft, setStaffDraft] = useState({ op: "", date: "", time: "" });
  const [showAssignForm, setShowAssignForm] = useState<"verifier" | "shipper" | "deployer" | null>(null);

  const todayStr = new Date().toISOString().split("T")[0];

  const resetForm = () => {
    setStaffDraft({ op: "", date: "", time: "" });
    setShowAssignForm(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <div className={`h-[2px] -mx-4 -mt-4 mb-2 ${STAGE_ACCENT[lead.stage]}`} />

        <DialogHeader>
          <DialogTitle>{lead.site}</DialogTitle>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-muted-foreground">{lead.city}</span>
            <span className="text-[9px] uppercase tracking-wide font-semibold text-muted-foreground px-1.5 py-0.5 bg-muted">
              {STAGE_DISPLAY_LABEL[lead.stage]}
            </span>
          </div>
        </DialogHeader>

        {/* Core metrics */}
        <div className="grid grid-cols-3 gap-3 py-3 border-y border-border">
          <Metric label="Workers" value={String(lead.headcount)} />
          <Metric label="Duration" value={`${lead.duration} days`} />
          <Metric label="Rep" value={lead.rep} />
        </div>

        {/* Factory profile */}
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

        {/* Pipeline assignments */}
        {lead.verifier && (
          <div className="space-y-1 pt-2 border-t border-border/50">
            <SectionLabel>Customer Success — site verification</SectionLabel>
            <Row label="Assigned operator" value={lead.verifier} />
            {lead.visitDate && <Row label="Visit date" value={lead.visitDate} />}
          </div>
        )}

        {lead.deploymentDeviceCount != null && (
          <div className="space-y-1 pt-2 border-t border-border/50">
            <SectionLabel>Allocation</SectionLabel>
            {lead.deploymentRegion && <Row label="Region" value={lead.deploymentRegion} />}
            <Row label="Devices" value={String(lead.deploymentDeviceCount)} />
          </div>
        )}

        {lead.shipper && (
          <div className="space-y-1 pt-2 border-t border-border/50">
            <SectionLabel>Shipment</SectionLabel>
            <Row label="Shipper" value={lead.shipper} />
          </div>
        )}

        {lead.deployer && (
          <div className="space-y-1 pt-2 border-t border-border/50">
            <SectionLabel>Deployment</SectionLabel>
            <Row label="Deployer" value={lead.deployer} />
            <Row label="Date" value={lead.deployDate ?? "—"} />
            <Row label="Time" value={lead.deployTime ?? "—"} />
          </div>
        )}

        {lead.notes && (
          <div className="pt-2 border-t border-border/50">
            <SectionLabel>Protocols</SectionLabel>
            <div className="text-[11px] leading-relaxed mt-1">{lead.notes}</div>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="pt-3 border-t border-border space-y-2">
          {/* Leads: accept/reject */}
          {lead.stage === "Leads" && (lead.status === "lead" || lead.status === "confirmed") && (
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

          {/* Pending Visit (CS): verify / reject */}
          {lead.stage === "Pending Visit" && lead.verifier && !showAssignForm && (
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 h-8 text-[11px]" onClick={() => { onMarkVerified?.(); onOpenChange(false); }}>
                Mark verified (site OK for allocation)
              </Button>
              <Button size="sm" variant="destructive" className="h-8 text-[11px]" onClick={() => {
                if (window.confirm(`Reject "${lead.site}"?`)) { onReject?.(); onOpenChange(false); }
              }}>
                Reject
              </Button>
            </div>
          )}

          {/* Pending Visit (CS): assign operator */}
          {lead.stage === "Pending Visit" && !lead.verifier && !showAssignForm && (
            <Button size="sm" variant="outline" className="w-full h-8 text-[11px]" onClick={() => setShowAssignForm("verifier")}>
              Assign CS operator
            </Button>
          )}

          {/* Pending Allocation: map allocation + reject */}
          {lead.stage === "Pending Allocation" && !showAssignForm && (
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground leading-snug">
                Use the map above: enter allocation mode, pick a hub, and confirm how many devices ship to this factory.
              </p>
              <Button size="sm" className="w-full h-8 text-[11px]" onClick={() => { onAllocate?.(); onOpenChange(false); }}>
                Allocate devices on map…
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="w-full h-8 text-[11px]"
                onClick={() => {
                  if (window.confirm(`Reject "${lead.site}"?`)) {
                    onReject?.();
                    onOpenChange(false);
                  }
                }}
              >
                Reject
              </Button>
            </div>
          )}

          {/* Pending Shipment: assign shipper → dispatch → deliver */}
          {lead.stage === "Pending Shipment" && !lead.shipper && !showAssignForm && (
            <Button size="sm" variant="outline" className="w-full h-8 text-[11px]" onClick={() => setShowAssignForm("shipper")}>
              Assign Shipper
            </Button>
          )}
          {lead.stage === "Pending Shipment" && lead.shipper && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 h-8 text-[11px]" onClick={() => { onMarkDispatched?.(); }}>
                Mark Dispatched
              </Button>
              <Button size="sm" className="flex-1 h-8 text-[11px]" onClick={() => { onMarkDelivered?.(); onOpenChange(false); }}>
                Mark Delivered
              </Button>
            </div>
          )}

          {/* Pending Deployment: assign deployer → confirm */}
          {lead.stage === "Pending Deployment" && !lead.deployer && !showAssignForm && (
            <Button size="sm" variant="outline" className="w-full h-8 text-[11px]" onClick={() => setShowAssignForm("deployer")}>
              Schedule Deployment
            </Button>
          )}
          {lead.stage === "Pending Deployment" && lead.deployer && (
            <Button size="sm" className="w-full h-8 text-[11px]" onClick={() => {
              if (window.confirm(`Confirm deployment for "${lead.site}"?`)) { onConfirmDeploy?.(); onOpenChange(false); }
            }}>
              Confirm Deployment
            </Button>
          )}

          {/* Inline assignment form (verifier / shipper / deployer) */}
          {showAssignForm && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <SectionLabel>
                {showAssignForm === "verifier"
                  ? "Assign CS operator (site visit)"
                  : showAssignForm === "shipper"
                    ? "Assign shipper"
                    : "Schedule deployment ops"}
              </SectionLabel>
              <select
                value={staffDraft.op}
                onChange={(e) => setStaffDraft((d) => ({ ...d, op: e.target.value }))}
                className="w-full h-8 text-[11px] border border-input bg-transparent px-2 outline-none"
              >
                <option value="">Select ops operator…</option>
                {operators.map((op) => (
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
              {showAssignForm === "deployer" && (
                <input
                  type="time"
                  value={staffDraft.time}
                  onChange={(e) => setStaffDraft((d) => ({ ...d, time: e.target.value }))}
                  className="w-full h-8 text-[11px] border border-input bg-transparent px-2 outline-none"
                />
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 h-8 text-[11px]"
                  disabled={
                    !staffDraft.op || !staffDraft.date ||
                    (showAssignForm === "deployer" && !staffDraft.time)
                  }
                  onClick={() => {
                    if (showAssignForm === "verifier") {
                      onAssignVerifier?.(staffDraft.op, staffDraft.date);
                    } else if (showAssignForm === "shipper") {
                      onAssignShipper?.(staffDraft.op, staffDraft.date);
                    } else {
                      onAssignDeployer?.(staffDraft.op, staffDraft.date, staffDraft.time);
                    }
                    resetForm();
                    onOpenChange(false);
                  }}
                >
                  Confirm
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
