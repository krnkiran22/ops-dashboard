"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "./KanbanColumn";
import { DraggableLeadCard } from "./DraggableLeadCard";
import { LeadCard } from "./LeadCard";
import { LeadDetailDialog } from "./LeadDetailDialog";
import {
  type Lead,
  type LeadStage,
  type Operator,
  getTransitionRule,
  STAGE_COLUMN_DESCRIPTION,
  STAGE_DISPLAY_LABEL,
} from "./ops-kanban-data";

const PIPELINE_STAGE_ORDER: LeadStage[] = [
  "Leads",
  "Pending Visit",
  "Pending Allocation",
  "Pending Shipment",
  "Pending Deployment",
];

const STAGE_ACCENT: Record<LeadStage, string> = {
  Leads: "bg-yellow-500",
  "Pending Visit": "bg-orange-500",
  "Pending Allocation": "bg-blue-500",
  "Pending Shipment": "bg-violet-500",
  "Pending Deployment": "bg-green-500",
};

interface PendingTransition {
  lead: Lead;
  from: LeadStage;
  to: LeadStage;
}

interface KanbanBoardProps {
  leads: Lead[];
  operators: Operator[];
  isLoading?: boolean;
  selectedLeadId: string | null;
  onSelectLead: (id: string | null) => void;
  onAccept: (leadId: string) => void;
  onReject: (leadId: string) => void;
  onAssignVerifier: (leadId: string, staffId: string, date: string) => void;
  onMarkVerified: (leadId: string) => void;
  onAllocate: (leadId: string) => void;
  onAssignShipper: (leadId: string, staffId: string, date: string) => void;
  onMarkDispatched: (leadId: string) => void;
  onMarkDelivered: (leadId: string) => void;
  onAssignDeployer: (leadId: string, staffId: string, date: string, time: string) => void;
  onConfirmDeploy: (leadId: string) => void;
}

/**
 * Drag-and-drop kanban board — orchestrates columns, transitions,
 * and modals for actions that require user input.
 */
export function KanbanBoard({
  leads,
  operators,
  isLoading,
  selectedLeadId,
  onSelectLead,
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
}: KanbanBoardProps) {
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [pendingTransition, setPendingTransition] = useState<PendingTransition | null>(null);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const lead = event.active.data.current?.lead as Lead | undefined;
    setActiveLead(lead ?? null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveLead(null);
    const { active, over } = event;
    if (!over) return;

    const lead = active.data.current?.lead as Lead | undefined;
    const sourceStage = active.data.current?.sourceStage as LeadStage | undefined;
    const targetStage = over.id as LeadStage;

    if (!lead || !sourceStage || sourceStage === targetStage) return;

    const rule = getTransitionRule(sourceStage, targetStage);
    if (!rule) return;

    // Simple transitions fire immediately
    if (!rule.needsInput) {
      switch (rule.action) {
        case "verify":
          onMarkVerified(lead.id);
          break;
        case "deliver":
          onMarkDelivered(lead.id);
          break;
        case "deploy":
          if (window.confirm(`Confirm deployment for "${lead.site}"?`)) {
            onConfirmDeploy(lead.id);
          }
          break;
      }
      return;
    }

    // Complex transitions open a modal or enter allocation mode
    if (rule.action === "allocate") {
      onAllocate(lead.id);
    } else {
      setPendingTransition({ lead, from: sourceStage, to: targetStage });
    }
  }, [onMarkVerified, onMarkDelivered, onConfirmDeploy, onAllocate]);

  const handleCardClick = useCallback((lead: Lead) => {
    setDetailLead(lead);
    onSelectLead(lead.id);
  }, [onSelectLead]);

  return (
    <>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex-1 flex overflow-x-auto min-h-0">
          {PIPELINE_STAGE_ORDER.map((stageKey) => {
            const stageLeads = leads.filter((l) => l.stage === stageKey);

            return (
              <KanbanColumn
                key={stageKey}
                stage={stageKey}
                label={STAGE_DISPLAY_LABEL[stageKey]}
                description={STAGE_COLUMN_DESCRIPTION[stageKey]}
                accent={STAGE_ACCENT[stageKey]}
                count={stageLeads.length}
                isLoading={isLoading}
              >
                {stageLeads.map((lead) => (
                  <DraggableLeadCard
                    key={lead.id}
                    lead={lead}
                    selected={selectedLeadId === lead.id}
                    onSelect={() => handleCardClick(lead)}
                    operators={operators}
                    onAccept={() => onAccept(lead.id)}
                    onReject={() => onReject(lead.id)}
                    onAssignVerifier={(sid, d) => onAssignVerifier(lead.id, sid, d)}
                    onMarkVerified={() => onMarkVerified(lead.id)}
                    onAllocate={() => onAllocate(lead.id)}
                    onAssignShipper={(sid, d) => onAssignShipper(lead.id, sid, d)}
                    onMarkDispatched={() => onMarkDispatched(lead.id)}
                    onMarkDelivered={() => onMarkDelivered(lead.id)}
                    onAssignDeployer={(sid, d, t) => onAssignDeployer(lead.id, sid, d, t)}
                    onConfirmDeploy={() => onConfirmDeploy(lead.id)}
                  />
                ))}
              </KanbanColumn>
            );
          })}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeLead && (
            <div className="w-[200px] opacity-90 shadow-lg rotate-2">
              <LeadCard lead={activeLead} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Detail dialog — full info + action buttons */}
      {detailLead && (
        <LeadDetailDialog
          lead={detailLead}
          open={!!detailLead}
          onOpenChange={(open) => { if (!open) { setDetailLead(null); onSelectLead(null); } }}
          operators={operators}
          onAccept={() => onAccept(detailLead.id)}
          onReject={() => onReject(detailLead.id)}
          onAssignVerifier={(staffId, date) => onAssignVerifier(detailLead.id, staffId, date)}
          onMarkVerified={() => onMarkVerified(detailLead.id)}
          onAllocate={() => { if (detailLead) { onAllocate(detailLead.id); setDetailLead(null); } }}
          onAssignShipper={(staffId, date) => onAssignShipper(detailLead.id, staffId, date)}
          onMarkDispatched={() => onMarkDispatched(detailLead.id)}
          onMarkDelivered={() => onMarkDelivered(detailLead.id)}
          onAssignDeployer={(staffId, date, time) => onAssignDeployer(detailLead.id, staffId, date, time)}
          onConfirmDeploy={() => onConfirmDeploy(detailLead.id)}
        />
      )}

      {/* Assign verifier modal (triggered by drag from Leads → Pending Visit) */}
      {pendingTransition?.lead && pendingTransition.from === "Leads" && (
        <AssignStaffDialog
          title="Assign CS operator (site verification)"
          lead={pendingTransition.lead}
          operators={operators}
          onConfirm={(staffId, date) => {
            onAssignVerifier(pendingTransition.lead.id, staffId, date);
            setPendingTransition(null);
          }}
          onCancel={() => setPendingTransition(null)}
        />
      )}

      {/* Allocation is now handled by the main map in OpsKanbanPage */}
    </>
  );
}

// ---------------------------------------------------------------------------
// Inline staff assignment dialog for drag-triggered transitions
// ---------------------------------------------------------------------------

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

function AssignStaffDialog({
  title,
  lead,
  operators,
  onConfirm,
  onCancel,
}: {
  title: string;
  lead: Lead;
  operators: Operator[];
  onConfirm: (staffId: string, date: string) => void;
  onCancel: () => void;
}) {
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState("");
  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="sm:max-w-sm" showCloseButton>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <div className="text-[11px] text-muted-foreground mt-1">
            {lead.site} · {lead.city}
          </div>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <select
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className="w-full h-9 text-[12px] border border-input bg-transparent px-2 outline-none"
          >
            <option value="">Select ops operator…</option>
            {operators.map((op) => (
              <option key={op.id} value={op.id}>{op.name}</option>
            ))}
          </select>
          <input
            type="date"
            value={date}
            min={todayStr}
            onChange={(e) => setDate(e.target.value)}
            className="w-full h-9 text-[12px] border border-input bg-transparent px-2 outline-none"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 h-9 text-[12px]"
              disabled={!staffId || !date}
              onClick={() => onConfirm(staffId, date)}
            >
              Confirm
            </Button>
            <Button size="sm" variant="ghost" className="h-9 text-[12px]" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
