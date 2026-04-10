"use client";

import { OpsKanbanPage } from "@/components/ops/kanban/OpsKanbanPage";

/**
 * Full ops command center (admin Operations UI — lives in **buildai-ops** at `/admin`,
 * no longer embedded under buildai-dashboard): map + utilization rail, pipeline kanban below.
 */
export default function AdminPage() {
  return <OpsKanbanPage />;
}
