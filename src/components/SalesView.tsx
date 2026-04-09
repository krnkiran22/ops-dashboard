"use client";

import { useCallback, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { SalesMap, type FactoryPin, type PlacedPin } from "@/components/SalesMap";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AddressMapPicker } from "@/components/AddressMapPicker";
import {
  fetchLeads,
  submitLead,
  updateLead,
  confirmLead,
  type Lead as ApiLead,
  type StaffProfile,
} from "@/lib/api/staff";

const inputClass =
  "w-full h-10 border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 placeholder:text-muted-foreground";

const LEAD_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  lead:               { label: "Submitted",   className: "bg-muted text-muted-foreground" },
  confirmed:          { label: "Confirmed",   className: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" },
  accepted:           { label: "Under Review", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  deferred:           { label: "On Hold",      className: "bg-orange-500/15 text-orange-700 dark:text-orange-400" },
  rejected:           { label: "Not Selected", className: "bg-red-500/12 text-red-600 dark:text-red-400" },
  cancelled:          { label: "Cancelled",    className: "bg-muted text-muted-foreground" },
  pending_visit:      { label: "In Progress",  className: "bg-purple-500/15 text-purple-700 dark:text-purple-400" },
  pending_allocation: { label: "In Progress",  className: "bg-purple-500/15 text-purple-700 dark:text-purple-400" },
  pending_shipment:   { label: "In Progress",  className: "bg-purple-500/15 text-purple-700 dark:text-purple-400" },
  pending_deployment: { label: "In Progress",  className: "bg-purple-500/15 text-purple-700 dark:text-purple-400" },
  deployed:           { label: "Active",        className: "bg-green-500/15 text-green-700 dark:text-green-400" },
};

function mapApiLeadToPin(l: ApiLead): FactoryPin | null {
  const meta = l.metadata ?? {};
  const headcount = l.worker_count || 0;
  const lat = l.lat ?? (meta.lat as number | undefined);
  const lng = l.lng ?? (meta.lng as number | undefined);
  if (!lat || !lng) return null;
  const status = l.status || "lead";
  return {
    id: l.id,
    name: l.factory_name,
    city: l.address?.split(",").pop()?.trim() || (meta.city as string) || "",
    lat,
    lng,
    headcount,
    payout: 5 * headcount,
    status,
    contactName: l.contact_name || "",
    contactPhone: l.contact_phone || "",
    days: (meta.days as number) || 0,
  };
}

const INITIAL_REFER_FORM = {
  ownerApproved: "" as "" | "yes" | "no",
  name: "",
  address: "",
  city: "",
  startDate: "",
  days: 0,
  industry: "",
  shifts: 0 as number,
  workersPerShift: 0,
  protocols: "",
  ownerName: "",
  ownerPhone: "",
  whatsappConfirmed: false,
};

function DummyUserButton() {
  return (
    <button
      type="button"
      className="h-6 w-6 rounded-full border border-border text-[10px] font-semibold text-muted-foreground"
      title="Dummy auth"
      aria-label="Dummy user"
    >
      D
    </button>
  );
}

export interface SalesViewProps {
  profile: StaffProfile;
  /** Top-left brand label (default "build"). */
  headerBrand?: string;
}

export function SalesView({ profile, headerBrand = "build" }: SalesViewProps) {
  const { resolvedTheme } = useTheme();
  const [pins, setPins] = useState<FactoryPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [placed, setPlaced] = useState<PlacedPin | null>(null);

  const [referOpen, setReferOpen] = useState(false);
  const [referForm, setReferForm] = useState({ ...INITIAL_REFER_FORM });
  const [referSubmitting, setReferSubmitting] = useState(false);
  const [referError, setReferError] = useState("");

  const loadLeads = useCallback(async () => {
    try {
      setLoading(true);
      const raw = await fetchLeads(profile.id);
      const apiLeads = Array.isArray(raw) ? raw : (raw as unknown as { items: ApiLead[] }).items ?? [];
      setPins(apiLeads.map(mapApiLeadToPin).filter((p): p is FactoryPin => p !== null));
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [profile.id]);

  useEffect(() => { void loadLeads(); }, [loadLeads]);

  const activeLeads = pins.filter((p) => p.status !== "rejected");
  const totalEarnings = activeLeads.reduce((s, l) => s + l.payout, 0);

  function handleManageFactory(_factory: FactoryPin) {
    // Popup card is the management surface for now.
  }

  function openReferModal() {
    setReferForm({ ...INITIAL_REFER_FORM });
    setReferError("");
    setPlaced(null);
    setReferOpen(true);
  }

  function closeReferModal() {
    setReferOpen(false);
    setPlaced(null);
  }

  const totalWorkers = referForm.shifts && referForm.workersPerShift
    ? referForm.shifts * referForm.workersPerShift
    : 0;

  async function handleSubmitRefer() {
    if (referForm.ownerApproved !== "yes") {
      setReferError("Owner/CEO approval is required.");
      return;
    }
    if (!referForm.name.trim()) {
      setReferError("Factory name is required.");
      return;
    }
    if (!placed) {
      setReferError("Please search and select an address.");
      return;
    }
    if (!referForm.ownerName.trim()) {
      setReferError("Factory POC name is required.");
      return;
    }
    if (!referForm.ownerPhone.trim()) {
      setReferError("Factory POC phone is required.");
      return;
    }
    setReferSubmitting(true);
    setReferError("");
    try {
      await submitLead({
        staff_id: profile.id,
        factory_name: referForm.name,
        address: placed.address || undefined,
        city: referForm.city || placed.city || undefined,
        state: placed.state || undefined,
        postal_code: placed.postalCode || undefined,
        worker_count: totalWorkers || undefined,
        contact_name: referForm.ownerName || undefined,
        contact_phone: referForm.ownerPhone || undefined,
        lat: placed.lat,
        lng: placed.lng,
        planned_start: referForm.startDate || undefined,
        industry: referForm.industry || undefined,
        shifts: referForm.shifts || undefined,
        workers_per_shift: referForm.workersPerShift || undefined,
        notes: referForm.protocols || undefined,
        metadata: {
          days: referForm.days || undefined,
          whatsapp_confirmed: referForm.whatsappConfirmed || undefined,
          google_place_id: placed.placeId || undefined,
          google_maps_url: placed.googleMapsUrl || undefined,
        },
      });
      closeReferModal();
      void loadLeads();
    } catch (err) {
      setReferError(
        err instanceof Error ? err.message : "Failed to submit."
      );
    } finally {
      setReferSubmitting(false);
    }
  }

  const rf = (field: keyof typeof referForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setReferForm((p) => ({ ...p, [field]: e.target.value }));

  const rfNum = (field: keyof typeof referForm) => (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => setReferForm((p) => ({
    ...p,
    [field]: parseInt(e.target.value) || 0,
  }));

  return (
    <div className="h-dvh flex flex-col bg-background">
      <div className="shrink-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border/30">
        <div className="flex items-center justify-between h-10 px-5">
          <span className="text-xs font-bold tracking-tight text-foreground font-display">{headerBrand}</span>
          <div className="flex items-center gap-5 text-[10px] tabular-nums text-muted-foreground">
            <span>Earnings <span className="text-foreground font-semibold">${totalEarnings.toLocaleString("en-US")}</span></span>
            <span>Factories <span className="text-foreground font-semibold">{activeLeads.length}</span></span>
          </div>
          <DummyUserButton />
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        {loading ? (
          <div className="flex items-center justify-center h-full"><Spinner className="size-5" /></div>
        ) : (
          <SalesMap
            factories={pins}
            onSelectFactory={handleManageFactory}
            onStatusChange={(fid, newStatus) => {
              const action = newStatus === "confirmed"
                ? confirmLead(fid)
                : updateLead(fid, { status: newStatus });
              void action.then(() => {
                setPins((prev) => prev.map((p) =>
                  p.id === fid ? { ...p, status: newStatus } : p
                ));
              });
            }}
            referMode={false}
            onPlacePin={() => {}}
            theme={resolvedTheme}
            className="w-full h-full"
          />
        )}

        {!loading && pins.length === 0 && !referOpen && (
          <div className="absolute inset-0 z-[400] flex flex-col items-center justify-center pointer-events-none">
            <div className="bg-background/90 backdrop-blur-sm border border-border px-8 py-6 text-center pointer-events-auto">
              <p className="text-sm font-semibold text-foreground">No factories referred yet</p>
              <p className="text-[11px] text-muted-foreground mt-1 mb-4">
                Submit your first factory referral to start earning.
              </p>
              <button
                type="button"
                onClick={openReferModal}
                className="h-10 px-6 bg-primary text-primary-foreground text-xs font-bold tracking-wide inline-flex items-center gap-1.5 transition-all active:scale-[0.98]"
              >
                Refer a Factory <span className="text-sm">&rarr;</span>
              </button>
            </div>
          </div>
        )}

        {!loading && pins.length > 0 && (
          <div className="absolute top-3 left-3 z-[400] bg-background/90 backdrop-blur-sm border border-border px-3 py-2 space-y-1">
            {(Object.keys(LEAD_STATUS_CONFIG) as string[]).map((s) => {
              const count = pins.filter((p) => p.status === s).length;
              if (count === 0) return null;
              return (
                <div key={s} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    s === "deployed" ? "bg-emerald-400" : s === "confirmed" ? "bg-yellow-400" : s === "rejected" || s === "cancelled" ? "bg-red-400" : s.startsWith("pending") ? "bg-purple-400" : "bg-zinc-400"
                  }`} />
                  <span className="text-[10px] text-muted-foreground">{LEAD_STATUS_CONFIG[s].label}</span>
                  <span className="text-[10px] font-semibold tabular-nums">{count}</span>
                </div>
              );
            })}
          </div>
        )}

        {!loading && pins.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 z-[400] bg-background/95 backdrop-blur-sm border-t border-border px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-display text-xl tracking-tight font-bold tabular-nums">${totalEarnings.toLocaleString("en-US")}</p>
                <p className="text-[10px] text-muted-foreground">$5 per worker · {activeLeads.length} active</p>
              </div>
              <button
                type="button"
                onClick={openReferModal}
                className="h-10 px-5 bg-primary text-primary-foreground text-xs font-bold tracking-wide inline-flex items-center gap-1.5 transition-all active:scale-[0.98]"
              >
                Refer a Factory <span className="text-sm">&rarr;</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={referOpen} onOpenChange={(open) => { if (!open) closeReferModal(); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Refer a Factory</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 text-sm">
            {referError && (
              <div className="border status-error px-3 py-2 text-xs">
                {referError}
              </div>
            )}

            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-foreground">
                Did the factory owner/CEO give explicit approval? *
              </legend>
              <div className="flex gap-4">
                {(["yes", "no"] as const).map((v) => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="ownerApproved"
                      value={v}
                      checked={referForm.ownerApproved === v}
                      onChange={() => setReferForm((p) => ({
                        ...p,
                        ownerApproved: v,
                      }))}
                      className="accent-primary"
                    />
                    <span className="text-sm capitalize">{v}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="space-y-1">
              <label className="text-xs font-semibold">Factory Name *</label>
              <input
                className={inputClass}
                placeholder="e.g. Lakshmi Textiles"
                value={referForm.name}
                onChange={rf("name")}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold">
                Factory Address *
              </label>
              <AddressMapPicker
                value={placed ? {
                  lat: placed.lat,
                  lng: placed.lng,
                  address: placed.address || "",
                  city: placed.city || "",
                } : null}
                onChange={(v) => {
                  setPlaced({
                    lat: v.lat,
                    lng: v.lng,
                    address: v.address,
                    city: v.city,
                  });
                  setReferForm((p) => ({
                    ...p,
                    city: v.city || p.city,
                  }));
                }}
                theme={resolvedTheme}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold">City</label>
              <input
                className={inputClass}
                placeholder="Auto-filled from address"
                value={referForm.city}
                onChange={rf("city")}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold">
                  Recording Start Date *
                </label>
                <input
                  type="date"
                  className={inputClass}
                  value={referForm.startDate}
                  onChange={rf("startDate")}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">
                  Total Days of Recording *
                </label>
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  placeholder="e.g. 30"
                  value={referForm.days || ""}
                  onChange={rfNum("days")}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold">Industry *</label>
              <input
                className={inputClass}
                placeholder="e.g. Garment, Automotive, Food Processing"
                value={referForm.industry}
                onChange={rf("industry")}
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold">
                How many shifts does the factory have? *
              </legend>
              <div className="flex gap-4">
                {[1, 2, 3].map((n) => (
                  <label key={n} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="shifts"
                      value={n}
                      checked={referForm.shifts === n}
                      onChange={() => setReferForm((p) => ({
                        ...p,
                        shifts: n,
                      }))}
                      className="accent-primary"
                    />
                    <span className="text-sm">{n}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="space-y-1">
              <label className="text-xs font-semibold">
                Worker Count / Shift *
              </label>
              <input
                type="number"
                min={0}
                className={inputClass}
                placeholder="Workers per shift"
                value={referForm.workersPerShift || ""}
                onChange={rfNum("workersPerShift")}
              />
              {totalWorkers > 0 && (
                <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">
                  Total workers: <span className="font-semibold text-foreground">{totalWorkers}</span>
                  {" · "}Est. payout: <span className="font-semibold text-foreground">${(5 * totalWorkers).toLocaleString("en-US")}</span>
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold">
                Factory Protocols the Ops Team Should Know About *
              </label>
              <textarea
                className={`${inputClass} h-20 py-2 resize-none`}
                placeholder="Entry requirements, safety gear, restricted areas..."
                value={referForm.protocols}
                onChange={(e) => setReferForm((p) => ({
                  ...p,
                  protocols: e.target.value,
                }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold">
                  Factory POC Name *
                </label>
                <input
                  className={inputClass}
                  placeholder="Full name"
                  value={referForm.ownerName}
                  onChange={rf("ownerName")}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">
                  Factory POC WhatsApp # *
                </label>
                <input
                  type="tel"
                  className={inputClass}
                  placeholder="+91 XXXXX XXXXX"
                  value={referForm.ownerPhone}
                  onChange={rf("ownerPhone")}
                />
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer border border-border p-3">
              <input
                type="checkbox"
                checked={referForm.whatsappConfirmed}
                onChange={(e) => setReferForm((p) => ({
                  ...p,
                  whatsappConfirmed: e.target.checked,
                }))}
                className="accent-primary mt-0.5"
              />
              <span className="text-xs leading-relaxed">
                I have added the Factory POC to a WhatsApp Group Chat
                with the Head of Customer Success and Head of Ops. *
              </span>
            </label>

            <button
              type="button"
              onClick={() => void handleSubmitRefer()}
              disabled={referSubmitting}
              className="w-full h-11 bg-primary text-primary-foreground text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {referSubmitting ? (
                <Spinner className="size-4 mx-auto" />
              ) : (
                "Submit Referral"
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
