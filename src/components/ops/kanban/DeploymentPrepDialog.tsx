"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Lead, Operator, DeploymentCrewRole } from "./ops-kanban-data";

export interface CrewDraftRow {
  staffId: string;
  role: DeploymentCrewRole;
}

interface Props {
  lead: Lead | null;
  open: boolean;
  staff: Operator[];
  onOpenChange: (open: boolean) => void;
  /** Persist crew metadata + primary deployer assignment (schedule). */
  onConfirm: (
    leadId: string,
    crew: CrewDraftRow[],
    scheduledDate: string,
    scheduledTime: string,
  ) => void;
}

/**
 * Pre-deploy checklist: field operators and chief operators who will install
 * devices, plus schedule. Primary `deployer` row uses the first chief, else
 * first crew member; full crew list is stored in lead metadata.
 */
export function DeploymentPrepDialog({ lead, open, staff, onOpenChange, onConfirm }: Props) {
  const [rows, setRows] = useState<CrewDraftRow[]>([{ staffId: "", role: "operator" }]);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const todayStr = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (lead && open) {
      if (lead.deploymentCrew.length > 0) {
        setRows(lead.deploymentCrew.map((c) => ({ staffId: c.staffId, role: c.role })));
      } else {
        setRows([{ staffId: lead.deployerStaffId ?? "", role: "operator" }]);
      }
      setScheduledDate(lead.deployDate ?? "");
      setScheduledTime(lead.deployTime ?? "");
    }
  }, [lead, open]);

  if (!lead) return null;

  const validRows = rows.filter((r) => r.staffId);
  const canSubmit =
    validRows.length > 0 && scheduledDate.length > 0 && scheduledTime.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" showCloseButton>
        <DialogHeader>
          <DialogTitle>Deployment crew & schedule</DialogTitle>
          <div className="text-[11px] text-muted-foreground mt-1">
            {lead.site} · {lead.city} · {lead.deploymentDeviceCount ?? "—"} devices
          </div>
        </DialogHeader>

        <p className="text-[10px] text-muted-foreground leading-snug">
          Add operators and chief operators who will deploy cameras on site. The first chief operator
          in the list becomes the primary scheduled deployer; everyone is recorded on the lead.
        </p>

        <div className="space-y-2 pt-2">
          {rows.map((row, i) => (
            <div key={i} className="flex gap-2 items-start">
              <select
                value={row.role}
                onChange={(e) => {
                  const role = e.target.value as DeploymentCrewRole;
                  setRows((prev) => prev.map((r, j) => (j === i ? { ...r, role } : r)));
                }}
                className="h-9 w-[130px] shrink-0 text-[11px] border border-input bg-transparent px-1 outline-none"
              >
                <option value="operator">Operator</option>
                <option value="chief_operator">Chief operator</option>
              </select>
              <select
                value={row.staffId}
                onChange={(e) => {
                  const staffId = e.target.value;
                  setRows((prev) => prev.map((r, j) => (j === i ? { ...r, staffId } : r)));
                }}
                className="flex-1 min-w-0 h-9 text-[11px] border border-input bg-transparent px-2 outline-none"
              >
                <option value="">Select staff…</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {rows.length > 1 && (
                <button
                  type="button"
                  className="h-9 px-2 text-[10px] text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="text-[11px] text-primary font-medium hover:underline"
            onClick={() => setRows((prev) => [...prev, { staffId: "", role: "operator" }])}
          >
            + Add crew member
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
          <label className="space-y-1">
            <span className="text-[10px] uppercase text-muted-foreground font-semibold">Deploy date</span>
            <input
              type="date"
              min={todayStr}
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full h-9 text-[12px] border border-input bg-transparent px-2 outline-none"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase text-muted-foreground font-semibold">Deploy time</span>
            <input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="w-full h-9 text-[12px] border border-input bg-transparent px-2 outline-none"
            />
          </label>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            size="sm"
            className="flex-1 h-9 text-[12px]"
            disabled={!canSubmit}
            onClick={() => {
              onConfirm(lead.id, validRows, scheduledDate, scheduledTime);
              onOpenChange(false);
            }}
          >
            Save crew & schedule
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-9 text-[12px]" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
