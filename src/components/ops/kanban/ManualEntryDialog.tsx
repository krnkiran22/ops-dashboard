"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CITY_COORDS } from "./ops-kanban-data";
import type { ManualLeadKind } from "@/lib/ops/manual-leads-storage";

const KNOWN_CITIES = Object.keys(CITY_COORDS).sort((a, b) => a.localeCompare(b));

export interface ManualEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: ManualLeadKind;
  onSubmit: (payload: {
    factoryName: string;
    city: string;
    workerCount: number;
    contactName?: string;
    contactPhone?: string;
    notes?: string;
  }) => void;
}

/**
 * Collects required factory details for a local-only (no API) kanban card.
 */
export function ManualEntryDialog({ open, onOpenChange, kind, onSubmit }: ManualEntryDialogProps) {
  const [factoryName, setFactoryName] = useState("");
  const [cityMode, setCityMode] = useState<"known" | "other">("known");
  const [citySelect, setCitySelect] = useState(KNOWN_CITIES[0] ?? "Mumbai");
  const [cityOther, setCityOther] = useState("");
  const [workerCount, setWorkerCount] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setFactoryName("");
    setCityMode("known");
    setCitySelect(KNOWN_CITIES[0] ?? "Mumbai");
    setCityOther("");
    setWorkerCount("");
    setContactName("");
    setContactPhone("");
    setNotes("");
  }, [open, kind]);

  const city =
    cityMode === "known" ? citySelect : cityOther.trim();

  const workers = Number.parseInt(workerCount, 10);
  const workersOk = Number.isFinite(workers) && workers > 0;

  const requireContact = kind === "deployment";
  const canSubmit =
    factoryName.trim().length > 0 &&
    city.length > 0 &&
    workersOk &&
    (!requireContact || contactName.trim().length > 0);

  const title = kind === "sales" ? "Add local lead (Sales)" : "Add local deployment";

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      factoryName: factoryName.trim(),
      city: city.trim(),
      workerCount: workers,
      contactName: contactName.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <p className="text-[11px] text-muted-foreground leading-snug pt-1">
            Stored in this browser only — not synced to the server. Pick a known city to show the pin on the map.
          </p>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
              Factory / site name <span className="text-destructive">*</span>
            </span>
            <input
              value={factoryName}
              onChange={(e) => setFactoryName(e.target.value)}
              className="w-full h-8 text-[12px] border border-input bg-transparent px-2 outline-none rounded-sm"
              placeholder="e.g. Acme Tirupur Unit 2"
              autoComplete="off"
            />
          </label>

          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
              City <span className="text-destructive">*</span>
            </span>
            <div className="flex gap-2">
              <select
                value={cityMode}
                onChange={(e) => setCityMode(e.target.value as "known" | "other")}
                className="h-8 text-[11px] border border-input bg-transparent px-2 outline-none rounded-sm shrink-0"
              >
                <option value="known">Known</option>
                <option value="other">Other</option>
              </select>
              {cityMode === "known" ? (
                <select
                  value={citySelect}
                  onChange={(e) => setCitySelect(e.target.value)}
                  className="flex-1 h-8 text-[12px] border border-input bg-transparent px-2 outline-none rounded-sm"
                >
                  {KNOWN_CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={cityOther}
                  onChange={(e) => setCityOther(e.target.value)}
                  className="flex-1 h-8 text-[12px] border border-input bg-transparent px-2 outline-none rounded-sm"
                  placeholder="City name"
                />
              )}
            </div>
          </div>

          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
              Worker headcount <span className="text-destructive">*</span>
            </span>
            <input
              type="number"
              min={1}
              step={1}
              value={workerCount}
              onChange={(e) => setWorkerCount(e.target.value)}
              className="w-full h-8 text-[12px] border border-input bg-transparent px-2 outline-none rounded-sm"
              placeholder="e.g. 120"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
              POC name {requireContact && <span className="text-destructive">*</span>}
            </span>
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="w-full h-8 text-[12px] border border-input bg-transparent px-2 outline-none rounded-sm"
              placeholder={requireContact ? "Required for deployment" : "Optional"}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
              Phone
            </span>
            <input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full h-8 text-[12px] border border-input bg-transparent px-2 outline-none rounded-sm"
              placeholder="Optional"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full text-[12px] border border-input bg-transparent px-2 py-1.5 outline-none rounded-sm resize-y min-h-[48px]"
              placeholder="Optional"
            />
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={!canSubmit} onClick={handleSubmit}>
            Add to board
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
