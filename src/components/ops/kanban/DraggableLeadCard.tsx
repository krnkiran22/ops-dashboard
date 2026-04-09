"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { LeadCard } from "./LeadCard";
import { canDrag, type Lead, type Operator, type VisitRole } from "./ops-kanban-data";

interface DraggableLeadCardProps {
  lead: Lead;
  selected?: boolean;
  onSelect?: () => void;
  staff?: Operator[];
  onAccept?: () => void;
  onReject?: () => void;
  onAssignVisitPrimary?: (staffId: string, date: string, role: VisitRole) => void;
  onAssignVisitSecondary?: (staffId: string, date: string, role: VisitRole) => void;
  onMarkVerified?: () => void;
  onAllocate?: () => void;
  onAssignShipper?: (staffId: string, date: string) => void;
  onMarkDispatched?: () => void;
  onMarkDelivered?: () => void;
  onOpenShipmentDetails?: () => void;
  onOpenDeploymentPrep?: () => void;
  onConfirmDeploy?: () => void;
}

/**
 * Draggable wrapper — disabled until sales accepts, and frozen once deployed.
 */
export function DraggableLeadCard({
  lead,
  selected,
  onSelect,
  staff,
  onAccept,
  onReject,
  onAssignVisitPrimary,
  onAssignVisitSecondary,
  onMarkVerified,
  onAllocate,
  onAssignShipper,
  onMarkDispatched,
  onMarkDelivered,
  onOpenShipmentDetails,
  onOpenDeploymentPrep,
  onConfirmDeploy,
}: DraggableLeadCardProps) {
  const draggable = canDrag(lead);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead, sourceStage: lead.stage },
    disabled: !draggable,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={draggable ? "cursor-grab active:cursor-grabbing" : "cursor-default"}
    >
      <LeadCard
        lead={lead}
        selected={selected}
        onSelect={onSelect}
        isDragging={isDragging}
        staff={staff}
        onAccept={onAccept}
        onReject={onReject}
        onAssignVisitPrimary={onAssignVisitPrimary}
        onAssignVisitSecondary={onAssignVisitSecondary}
        onMarkVerified={onMarkVerified}
        onAllocate={onAllocate}
        onAssignShipper={onAssignShipper}
        onMarkDispatched={onMarkDispatched}
        onMarkDelivered={onMarkDelivered}
        onOpenShipmentDetails={onOpenShipmentDetails}
        onOpenDeploymentPrep={onOpenDeploymentPrep}
        onConfirmDeploy={onConfirmDeploy}
      />
    </div>
  );
}
