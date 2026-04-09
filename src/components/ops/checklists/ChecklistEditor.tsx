"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  useOpsTaskChecklists,
  useUpsertOpsTaskChecklist,
} from "@/lib/queries/operations";
import type { OpsChecklistItem } from "@/lib/api/browser-api";

const ASSIGNMENT_TYPES = [
  { key: "verifier", label: "Verifier", description: "Site verification visits" },
  { key: "shipper", label: "Shipper", description: "Device shipping tasks" },
  { key: "deployer", label: "Deployer", description: "On-site deployment" },
] as const;

interface ChecklistFormState {
  title: string;
  instructions: string;
  items: OpsChecklistItem[];
}

/**
 * Admin editor for task checklists — one card per assignment type.
 * Fetches current checklists from the API and allows inline editing
 * with add/remove items and save.
 */
export function ChecklistEditor() {
  const { data, isLoading } = useOpsTaskChecklists();
  const upsert = useUpsertOpsTaskChecklist();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<ChecklistFormState>({ title: "", instructions: "", items: [] });
  const [saved, setSaved] = useState<string | null>(null);

  const checklists = data?.items ?? [];

  const startEdit = useCallback((type: string) => {
    const existing = checklists.find((c) => c.assignment_type === type);
    setForm({
      title: existing?.title ?? "",
      instructions: existing?.instructions ?? "",
      items: existing?.items ?? [],
    });
    setEditing(type);
    setSaved(null);
  }, [checklists]);

  const handleSave = useCallback(async () => {
    if (!editing) return;
    await upsert.mutateAsync({
      assignmentType: editing,
      title: form.title,
      items: form.items,
      instructions: form.instructions || null,
    });
    setSaved(editing);
    setEditing(null);
  }, [editing, form, upsert]);

  const addItem = () => {
    setForm((f) => ({
      ...f,
      items: [...f.items, { label: "", required: false }],
    }));
  };

  const removeItem = (index: number) => {
    setForm((f) => ({
      ...f,
      items: f.items.filter((_, i) => i !== index),
    }));
  };

  const updateItem = (index: number, field: keyof OpsChecklistItem, value: string | boolean) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    }));
  };

  if (isLoading) {
    return (
      <div className="text-[11px] text-muted-foreground py-8 text-center">
        Loading checklists…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[11px] uppercase tracking-[0.12em] font-semibold">
          Task Checklists
        </h2>
        <span className="text-[10px] text-muted-foreground">
          {checklists.length} configured
        </span>
      </div>

      {ASSIGNMENT_TYPES.map(({ key, label, description }) => {
        const existing = checklists.find((c) => c.assignment_type === key);
        const isEditing = editing === key;
        const justSaved = saved === key;

        return (
          <div key={key} className="border border-border bg-card">
            <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
              <div>
                <div className="text-[12px] font-semibold">{label}</div>
                <div className="text-[10px] text-muted-foreground">{description}</div>
              </div>
              {!isEditing && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  onClick={() => startEdit(key)}
                >
                  {existing ? "Edit" : "Configure"}
                </Button>
              )}
            </div>

            {isEditing ? (
              <div className="px-4 py-3 space-y-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                    Title
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full h-8 mt-1 text-[12px] border border-input bg-transparent px-2 outline-none"
                    placeholder="e.g. Site Verification Checklist"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                    Instructions
                  </label>
                  <textarea
                    value={form.instructions}
                    onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
                    className="w-full mt-1 text-[12px] border border-input bg-transparent px-2 py-1.5 outline-none min-h-[60px] resize-y"
                    placeholder="Instructions shown to operators above the checklist…"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                    Items
                  </label>
                  <div className="mt-1 space-y-1.5">
                    {form.items.map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={item.required}
                          onChange={(e) => updateItem(i, "required", e.target.checked)}
                          title="Required"
                          className="h-3.5 w-3.5 shrink-0 accent-primary"
                        />
                        <input
                          type="text"
                          value={item.label}
                          onChange={(e) => updateItem(i, "label", e.target.value)}
                          className="flex-1 h-7 text-[11px] border border-input bg-transparent px-2 outline-none"
                          placeholder="Checklist item…"
                        />
                        <button
                          type="button"
                          onClick={() => removeItem(i)}
                          className="text-[11px] text-destructive hover:text-destructive/80 px-1"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px] mt-1.5"
                    onClick={addItem}
                  >
                    + Add Item
                  </Button>
                </div>

                <div className="flex gap-2 pt-1 border-t border-border/30">
                  <Button
                    size="sm"
                    className="h-8 text-[11px] px-4"
                    disabled={!form.title.trim() || form.items.length === 0 || upsert.isPending}
                    onClick={() => void handleSave()}
                  >
                    {upsert.isPending ? "Saving…" : "Save Changes"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-[11px]"
                    onClick={() => setEditing(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : existing ? (
              <div className="px-4 py-3">
                <div className="text-[11px] font-medium mb-1">{existing.title}</div>
                {existing.instructions && (
                  <div className="text-[10px] text-muted-foreground mb-2">{existing.instructions}</div>
                )}
                <div className="space-y-1">
                  {existing.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px]">
                      <span className="text-muted-foreground tabular-nums shrink-0 w-4 text-right">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{item.label}</span>
                      {item.required && (
                        <span className="text-destructive text-[9px]">*</span>
                      )}
                    </div>
                  ))}
                </div>
                {justSaved && (
                  <div className="mt-2 text-[10px] text-green-600 dark:text-green-400 font-medium">
                    Saved
                  </div>
                )}
              </div>
            ) : (
              <div className="px-4 py-4 text-center text-[11px] text-muted-foreground">
                No checklist configured yet
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
