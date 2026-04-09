"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Lead } from "./ops-kanban-data";

interface Props {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (leadId: string, fields: ShipmentLogisticsFields) => void;
}

export interface ShipmentLogisticsFields {
  expectedDelivery: string;
  carrier: string;
  tracking: string;
  logisticsNotes: string;
}

/**
 * Captures carrier, ETA, tracking, and logistics notes for the shipment stage.
 * Values persist on the lead via merged metadata PATCH.
 */
export function ShipmentLogisticsDialog({ lead, open, onOpenChange, onSave }: Props) {
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [logisticsNotes, setLogisticsNotes] = useState("");

  useEffect(() => {
    if (lead && open) {
      setExpectedDelivery(lead.shipmentExpectedDelivery ?? "");
      setCarrier(lead.shipmentCarrier ?? "");
      setTracking(lead.shipmentTracking ?? "");
      setLogisticsNotes(lead.shipmentLogisticsNotes ?? "");
    }
  }, [lead, open]);

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Shipment & logistics</DialogTitle>
          <div className="text-[11px] text-muted-foreground mt-1">
            {lead.site} · {lead.city}
          </div>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
              Expected delivery date
            </span>
            <input
              type="date"
              value={expectedDelivery}
              onChange={(e) => setExpectedDelivery(e.target.value)}
              className="w-full h-9 text-[12px] border border-input bg-transparent px-2 outline-none"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
              Carrier / logistics partner
            </span>
            <input
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder="e.g. BlueDart, in-house"
              className="w-full h-9 text-[12px] border border-input bg-transparent px-2 outline-none"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
              Tracking / reference
            </span>
            <input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="AWB, LR number, etc."
              className="w-full h-9 text-[12px] border border-input bg-transparent px-2 outline-none"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
              Logistics notes
            </span>
            <textarea
              value={logisticsNotes}
              onChange={(e) => setLogisticsNotes(e.target.value)}
              rows={3}
              placeholder="Handoff instructions, dock hours, contacts…"
              className="w-full text-[12px] border border-input bg-transparent px-2 py-2 outline-none resize-none"
            />
          </label>
          <Button
            type="button"
            size="sm"
            className="w-full h-9 text-[12px]"
            onClick={() => {
              onSave(lead.id, { expectedDelivery, carrier, tracking, logisticsNotes });
              onOpenChange(false);
            }}
          >
            Save shipment details
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
