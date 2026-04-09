"use client";

import { useState, useCallback } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";
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
  type VisitRole,
  getTransitionRule,
} from "./ops-kanban-data";

const STAGES: { key: LeadStage; label: string; accent: string }[] = [
  { key: "Sales", label: "Sales", accent: "bg-yellow-500" },
  { key: "Customer Success", label: "Customer Success", accent: "bg-orange-500" },
  { key: "Allocation", label: "Allocation", accent: "bg-blue-500" },
  { key: "Shipment", label: "Shipment", accent: "bg-violet-500" },
  { key: "Deployment", label: "Deployment", accent: "bg-emerald-600" },
];

interface KanbanBoardProps {
  leads: Lead[];
  /** All assignable staff (CS, operators, logistics — not only ops_operator). */
  staff: Operator[];
  isLoading?: boolean;
  selectedLeadId: string | null;
  onSelectLead: (id: string | null) => void;
  onAccept: (leadId: string) => void;
  onReject: (leadId: string) => void;
  onAssignVisitPrimary: (leadId: string, staffId: string, date: string, role: VisitRole) => void;
  onAssignVisitSecondary: (leadId: string, staffId: string, date: string, role: VisitRole) => void;
  onMarkVerified: (leadId: string) => void;
  onAllocate: (leadId: string) => void;
  onMarkDispatched: (leadId: string) => void;
  onMarkDelivered: (leadId: string) => void;
  onOpenShipmentDetails: (leadId: string) => void;
  onOpenDeploymentPrep: (leadId: string) => void;
  onConfirmDeploy: (leadId: string) => void;
  onAddManualSales?: () => void;
  onAddManualDeployment?: () => void;
  onRemoveManual?: (leadId: string) => void;
}

/**
 * Drag-and-drop kanban — five columns with modals for visit assignment and allocation.
 */
export function KanbanBoard({
  leads,
  staff,
  isLoading,
  selectedLeadId,
  onSelectLead,
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
  onAddManualSales,
  onAddManualDeployment,
  onRemoveManual,
}: KanbanBoardProps) {
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const lead = event.active.data.current?.lead as Lead | undefined;
    setActiveLead(lead ?? null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveLead(null);
      const { active, over } = event;
      if (!over) return;

      const lead = active.data.current?.lead as Lead | undefined;
      const sourceStage = active.data.current?.sourceStage as LeadStage | undefined;
      const targetStage = over.id as LeadStage;

      if (!lead || !sourceStage || sourceStage === targetStage) return;

      const rule = getTransitionRule(sourceStage, targetStage);
      if (!rule) return;

      if (!rule.needsInput) {
        switch (rule.action) {
          case "verify":
            onMarkVerified(lead.id);
            break;
          case "deliver":
            onMarkDelivered(lead.id);
            break;
        }
        return;
      }

      if (rule.action === "allocate") {
        onAllocate(lead.id);
      }
    },
    [onMarkVerified, onMarkDelivered, onAllocate],
  );

  const handleCardClick = useCallback(
    (lead: Lead) => {
      setDetailLead(lead);
      onSelectLead(lead.id);
    },
    [onSelectLead],
  );

  return (
    <>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex-1 flex overflow-x-auto min-h-0">
          {STAGES.map((stage) => {
            const stageLeads = leads.filter((l) => l.stage === stage.key);

            const addButton =
              stage.key === "Sales" && onAddManualSales ? (
                <button
                  type="button"
                  title="Add local lead"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddManualSales();
                  }}
                  className="inline-flex h-6 w-6 items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                >
                  <HugeiconsIcon icon={Add01Icon} className="size-3.5" strokeWidth={2} />
                </button>
              ) : stage.key === "Deployment" && onAddManualDeployment ? (
                <button
                  type="button"
                  title="Add local deployment"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddManualDeployment();
                  }}
                  className="inline-flex h-6 w-6 items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                >
                  <HugeiconsIcon icon={Add01Icon} className="size-3.5" strokeWidth={2} />
                </button>
              ) : undefined;

            return (
              <KanbanColumn
                key={stage.key}
                stage={stage.key}
                label={stage.label}
                accent={stage.accent}
                count={stageLeads.length}
                isLoading={isLoading}
                headerRight={addButton}
              >
                {stageLeads.map((lead) => (
                  <DraggableLeadCard
                    key={lead.id}
                    lead={lead}
                    selected={selectedLeadId === lead.id}
                    onSelect={() => handleCardClick(lead)}
                    staff={staff}
                    onAccept={() => onAccept(lead.id)}
                    onReject={() => onReject(lead.id)}
                    onAssignVisitPrimary={(sid, d, r) => onAssignVisitPrimary(lead.id, sid, d, r)}
                    onAssignVisitSecondary={(sid, d, r) => onAssignVisitSecondary(lead.id, sid, d, r)}
                    onMarkVerified={() => onMarkVerified(lead.id)}
                    onAllocate={() => onAllocate(lead.id)}
                    onMarkDispatched={() => onMarkDispatched(lead.id)}
                    onMarkDelivered={() => onMarkDelivered(lead.id)}
                    onOpenShipmentDetails={() => onOpenShipmentDetails(lead.id)}
                    onOpenDeploymentPrep={() => onOpenDeploymentPrep(lead.id)}
                    onConfirmDeploy={() => onConfirmDeploy(lead.id)}
                    onRemoveManual={onRemoveManual ? () => onRemoveManual(lead.id) : undefined}
                  />
                ))}
              </KanbanColumn>
            );
          })}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeLead && (
            <div className="w-[200px] opacity-90 shadow-lg rotate-2">
              <LeadCard lead={activeLead} staff={staff} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {detailLead && (
        <LeadDetailDialog
          lead={detailLead}
          open={!!detailLead}
          onOpenChange={(open) => {
            if (!open) {
              setDetailLead(null);
              onSelectLead(null);
            }
          }}
          staff={staff}
          onAccept={() => onAccept(detailLead.id)}
          onReject={() => onReject(detailLead.id)}
          onAssignVisitPrimary={(sid, d, r) => onAssignVisitPrimary(detailLead.id, sid, d, r)}
          onAssignVisitSecondary={(sid, d, r) => onAssignVisitSecondary(detailLead.id, sid, d, r)}
          onMarkVerified={() => onMarkVerified(detailLead.id)}
          onAllocate={() => {
            onAllocate(detailLead.id);
            setDetailLead(null);
          }}
          onMarkDispatched={() => onMarkDispatched(detailLead.id)}
          onMarkDelivered={() => onMarkDelivered(detailLead.id)}
          onOpenShipmentDetails={() => onOpenShipmentDetails(detailLead.id)}
          onOpenDeploymentPrep={() => onOpenDeploymentPrep(detailLead.id)}
          onConfirmDeploy={() => onConfirmDeploy(detailLead.id)}
          onRemoveManual={onRemoveManual ? () => onRemoveManual(detailLead.id) : undefined}
        />
      )}
    </>
  );
}
