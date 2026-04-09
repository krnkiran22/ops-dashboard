"use client";

import { useDroppable } from "@dnd-kit/core";
import type { LeadStage } from "./ops-kanban-data";

interface KanbanColumnProps {
  stage: LeadStage;
  label: string;
  accent: string;
  count: number;
  isLoading?: boolean;
  isOver?: boolean;
  /** e.g. “add local entry” control */
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Droppable kanban column — highlights when a valid card hovers over it.
 */
export function KanbanColumn({
  stage,
  label,
  accent,
  count,
  isLoading,
  headerRight,
  children,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage,
    data: { stage },
  });

  return (
    <div className="min-w-[220px] lg:min-w-0 flex-1 flex flex-col border-r border-border last:border-r-0">
      <div className="shrink-0 border-b border-border">
        <div className={`h-[2px] ${accent}`} />
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-[11px] uppercase tracking-[0.12em] font-semibold text-foreground truncate">
              {label}
            </h2>
            <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">
              {count}
            </span>
            {headerRight != null && (
              <span className="ml-auto shrink-0 flex items-center">{headerRight}</span>
            )}
          </div>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 overflow-auto p-2 space-y-2 transition-colors ${
          isOver ? "bg-accent/30 ring-2 ring-inset ring-primary/30" : ""
        }`}
      >
        {children}
        {count === 0 && (
          <div className="flex items-center justify-center h-24 text-[11px] text-muted-foreground border border-dashed border-border/50">
            {isLoading ? "Loading…" : isOver ? "Drop here" : "No leads in this stage"}
          </div>
        )}
      </div>
    </div>
  );
}
