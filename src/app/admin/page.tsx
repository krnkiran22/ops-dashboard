"use client";

import { OpsKanbanPage } from "@/components/ops/kanban/OpsKanbanPage";

/**
 * Full ops command center (same layout as Dashboard → Ops): map + utilization rail,
 * pipeline kanban below.
 */
export default function AdminPage() {
  return <OpsKanbanPage />;
}
