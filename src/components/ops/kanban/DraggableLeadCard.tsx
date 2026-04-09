"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { LeadCard } from "./LeadCard";
import { canDrag, type Lead, type Operator } from "./ops-kanban-data";

interface DraggableLeadCardProps {
  lead: Lead;
  selected?: boolean;
  onSelect?: () => void;
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
 * Draggable wrapper around LeadCard — Sales column cards are not draggable;
 * CS onward supports drag when the transition graph allows it.
 */
export function DraggableLeadCard({
  lead,
  selected,
  onSelect,
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
        operators={operators}
        onAccept={onAccept}
        onReject={onReject}
        onAssignVerifier={onAssignVerifier}
        onMarkVerified={onMarkVerified}
        onAllocate={onAllocate}
        onAssignShipper={onAssignShipper}
        onMarkDispatched={onMarkDispatched}
        onMarkDelivered={onMarkDelivered}
        onAssignDeployer={onAssignDeployer}
        onConfirmDeploy={onConfirmDeploy}
      />
    </div>
  );
}
