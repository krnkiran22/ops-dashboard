"use client";

import { useCallback, useEffect, useState } from "react";
import {
  loadManualLeads,
  MANUAL_LEAD_ID_PREFIX,
  saveManualLeads,
  type ManualLeadKind,
  type StoredManualLead,
} from "@/lib/ops/manual-leads-storage";

export type ManualLeadDraft = Omit<StoredManualLead, "id" | "createdAt">;

export function useManualLeads() {
  const [records, setRecords] = useState<StoredManualLead[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setRecords(loadManualLeads());
    setHydrated(true);
  }, []);

  const add = useCallback((kind: ManualLeadKind, draft: Omit<ManualLeadDraft, "kind">) => {
    const id = `${MANUAL_LEAD_ID_PREFIX}${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    const row: StoredManualLead = {
      ...draft,
      kind,
      id,
      createdAt,
    };
    setRecords((prev) => {
      const next = [...prev, row];
      saveManualLeads(next);
      return next;
    });
    return id;
  }, []);

  const remove = useCallback((id: string) => {
    setRecords((prev) => {
      const next = prev.filter((r) => r.id !== id);
      saveManualLeads(next);
      return next;
    });
  }, []);

  return { records, add, remove, hydrated };
}
