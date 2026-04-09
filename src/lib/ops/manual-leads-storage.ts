import type { Lead } from "@/components/ops/kanban/ops-kanban-data";
import { CITY_COORDS, LeadStatus } from "@/components/ops/kanban/ops-kanban-data";

export const MANUAL_LEAD_ID_PREFIX = "manual-";

const STORAGE_KEY = "ops-dashboard:manual-leads:v1";

export type ManualLeadKind = "sales" | "deployment";

export interface StoredManualLead {
  id: string;
  createdAt: string;
  kind: ManualLeadKind;
  factoryName: string;
  city: string;
  workerCount: number;
  contactName?: string;
  contactPhone?: string;
  notes?: string;
}

export function isManualLeadId(id: string): boolean {
  return id.startsWith(MANUAL_LEAD_ID_PREFIX);
}

export function loadManualLeads(): StoredManualLead[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStoredManualLead);
  } catch {
    return [];
  }
}

export function saveManualLeads(records: StoredManualLead[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    /* quota / private mode */
  }
}

function isStoredManualLead(v: unknown): v is StoredManualLead {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.createdAt === "string" &&
    (o.kind === "sales" || o.kind === "deployment") &&
    typeof o.factoryName === "string" &&
    typeof o.city === "string" &&
    typeof o.workerCount === "number"
  );
}

export function manualRecordToLead(record: StoredManualLead): Lead {
  const isSales = record.kind === "sales";
  const coords = CITY_COORDS[record.city];
  return {
    id: record.id,
    site: record.factoryName,
    city: record.city,
    headcount: record.workerCount,
    duration: 0,
    stage: isSales ? "Sales" : "Deployment",
    status: isSales ? LeadStatus.LEAD : LeadStatus.PENDING_DEPLOYMENT,
    triageBadge: isSales ? "New" : undefined,
    rep: "Manual",
    repId: "manual",
    lat: coords?.[0],
    lng: coords?.[1],
    rawMetadata: { manual_entry: true },
    deploymentCrew: [],
    contactName: record.contactName,
    contactPhone: record.contactPhone,
    notes: record.notes,
  };
}
