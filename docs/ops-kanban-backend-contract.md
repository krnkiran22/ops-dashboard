# Ops admin dashboard — backend API contract

This document is for **backend engineers** implementing or extending APIs consumed by the **Build AI admin Operations page** (`/ops` in `apps/buildai-dashboard`): the map + five-column lead pipeline (Sales → Customer Success → Allocation → Shipment → Deployment), utilization sidebar, and task checklist settings.

All paths below are under the API gateway **`/v1`** prefix (the dashboard client prepends `/v1` automatically).

---

## 1. Response envelope (how the dashboard parses JSON)

The shared browser client (`normalizeEnvelopePayload` in `apps/buildai-dashboard/src/lib/api/browser-client.ts`) normalizes responses as follows:

| Server body shape | After normalization (what React Query / hooks see) |
|-------------------|-----------------------------------------------------|
| `{ "data": [ ... ], "pagination": { ... } }` | `{ "items": [...], "total", "has_more", "page_size", "next_cursor", ... }` |
| `{ "data": { ...entity } }` | The **inner object only** (the entity) |
| `{ "data": { ... }, "request_id": "..." }` | The **inner `data` object** (`request_id` is dropped for typed return values) |

**Backend should keep emitting standard `ListEnvelope` / `DetailEnvelope` shapes**; do not rely on the dashboard reading `request_id` for pipeline logic.

TypeScript fetch helpers for **POST pipeline actions** in `browser-api.ts` are written as `const res = await apiFetch<{ data: T }>(...); return res.data` — with normalization, `apiFetch` often already returns `T`; if anything returns the full envelope, those helpers should be aligned. The **wire format** you implement should remain **`{ "data": ... }`**.

---

## 2. Complete HTTP surface (Ops `/ops` page)

All paths are relative to **`/v1`** (e.g. `GET /v1/ops/leads`). This table is the **full set** of methods and routes the kanban page, map, utilization sidebar, and checklist editor call via `browser-api.ts` + `operations.ts` hooks.

| Method | Path | Purpose |
|--------|------|---------|
| **GET** | `/ops/leads` | List leads (optional query `staff_id` — UUID — filter by salesperson) |
| **GET** | `/ops/leads/{lead_id}/assignments` | List assignments (`verifier`, `shipper`, `deployer`) for one lead |
| **PATCH** | `/ops/leads/{lead_id}` | Update lead; dashboard sends merged **`metadata`** (and may send other fields) |
| **POST** | `/ops/leads/{lead_id}/accept` | Move past triage (accepted → CS column in UI) |
| **POST** | `/ops/leads/{lead_id}/reject` | Reject lead |
| **POST** | `/ops/leads/{lead_id}/assign-verifier` | Primary site visit assignment |
| **POST** | `/ops/leads/{lead_id}/verify` | Site verified → pending allocation |
| **POST** | `/ops/leads/{lead_id}/allocate` | Allocate devices (body: source location, operator org, device count, notes) |
| **POST** | `/ops/leads/{lead_id}/assign-shipper` | Assign shipper *(optional; **admin ops kanban does not call this** — Shipment column uses logistics metadata + Dispatched/Delivered only)* |
| **POST** | `/ops/leads/{lead_id}/dispatch` | Mark dispatched |
| **POST** | `/ops/leads/{lead_id}/deliver` | Mark delivered → `pending_deployment` |
| **POST** | `/ops/leads/{lead_id}/assign-deployer` | Primary deployer schedule (used together with crew metadata) |
| **POST** | `/ops/leads/{lead_id}/deploy` | Mark deployed / live |
| **GET** | `/ops/staff` | Staff directory (all pickers: CS, operators, logistics) |
| **GET** | `/ops/locations` | Warehouse / hub pins (optional `active_only=true`) |
| **GET** | `/ops/task-checklists` | Task checklist templates by assignment type |
| **PUT** | `/ops/task-checklists/{assignment_type}` | Create or replace a checklist template (`verifier`, `shipper`, `deployer`) |

**UI constraint:** **Confirm deployed** is disabled until `metadata.deployment_crew` contains **at least one** `{ staff_id, role }`. The **Plan deployment crew** flow writes that array (and calls **assign-deployer**). The gateway **POST `/deploy`** returns **409** if `deployment_crew` is missing or has no usable `staff_id` entries.

---

## 3. Lead `status` → dashboard column

The UI maps `ops.leads.status` to kanban columns (`apps/buildai-dashboard/src/components/ops/kanban/ops-kanban-data.ts`):

| `status` value | Column |
|----------------|--------|
| `lead`, `confirmed`, `rejected`, `cancelled`, `deferred` | **Sales** (triage; `rejected` / `cancelled` are filtered off the board) |
| `accepted`, `pending_visit` | **Customer Success** |
| `pending_allocation` | **Allocation** |
| `pending_shipment` | **Shipment** |
| `pending_deployment`, `deployed` | **Deployment** (`deployed` shows a “Live” badge) |

**Terminal on the board:** only `rejected` and `cancelled` are hidden from the main list. **`deployed` leads are still returned and shown** in Deployment.

---

## 4. Core type: `OpsLead` (fields the dashboard reads)

Defined in `apps/buildai-dashboard/src/lib/api/browser-api.ts` (`OpsLead`). The dashboard uses these fields:

| Field | Type | Used for |
|-------|------|----------|
| `id` | string (UUID) | Identity, URLs |
| `staff_id` | string | Sales rep; resolved via staff list to show name |
| `site_id` | string \| null | After verify; allocation requires site |
| `factory_name` | string | Card title / map label |
| `address`, `city`, `state`, `postal_code`, `country` | strings / null | Profile + map |
| `worker_count` | number \| null | Headcount |
| `contact_name`, `contact_phone` | string \| null | POC |
| `lat`, `lng` | number \| null | Map pins |
| `planned_start`, `planned_end` | string (date) \| null | Duration on card |
| `device_count` | number \| null | Device count display |
| `industry`, `shifts`, `workers_per_shift` | optional profile | Detail dialog |
| `status` | string | Column + actions |
| `notes` | string \| null | Protocols / notes |
| `metadata` | object | See §5 — **required object** (can be `{}`) |
| `created_at`, `updated_at` | string | Optional display / sorting |

**Example `OpsLead` (minimal JSON inside `data` or list `items`):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "staff_id": "660e8400-e29b-41d4-a716-446655440001",
  "site_id": null,
  "factory_name": "Acme Textiles",
  "address": "12 Industrial Area, Phase 2",
  "city": "Tirupur",
  "state": "TN",
  "postal_code": "641604",
  "country": "IN",
  "worker_count": 120,
  "contact_name": "R. Kumar",
  "contact_phone": "+919876543210",
  "lat": 11.1085,
  "lng": 77.3411,
  "planned_start": "2026-05-01",
  "planned_end": "2026-05-31",
  "device_count": 8,
  "industry": "Garment",
  "shifts": 2,
  "workers_per_shift": 60,
  "status": "pending_shipment",
  "notes": null,
  "metadata": {
    "deployment_id": "770e8400-e29b-41d4-a716-446655440002",
    "visit_verifier_role": "customer_success",
    "shipment_carrier": "BlueDart",
    "shipment_expected_delivery_date": "2026-04-15",
    "deployment_crew": [
      { "staff_id": "880e8400-e29b-41d4-a716-446655440003", "role": "chief_operator" },
      { "staff_id": "990e8400-e29b-41d4-a716-446655440004", "role": "operator" }
    ]
  },
  "created_at": "2026-04-01T10:00:00Z",
  "updated_at": "2026-04-08T12:00:00Z"
}
```

---

## 5. Lead `metadata` keys the dashboard writes or reads

The UI merges patches client-side, then **`PATCH /ops/leads/{id}` with a full replacement `metadata` object** (server typically replaces the JSON column — **backend must merge if you support partial metadata from other clients**).

| Key | Values | Set by |
|-----|--------|--------|
| `deployment_id` | string (UUID) | **Backend** on successful `allocate` (dashboard reads it to show allocation/shipment context) |
| `visit_verifier_role` | `"customer_success"` \| `"chief_operator"` | Dashboard after `assign-verifier` (labels the primary verifier row) |
| `visit_secondary_staff_id` | string (UUID) | Dashboard — second site visitor |
| `visit_secondary_scheduled_date` | string (date) | Dashboard |
| `visit_secondary_role` | `"customer_success"` \| `"chief_operator"` | Dashboard |
| `shipment_expected_delivery_date` | string (date) | Dashboard — shipment dialog |
| `shipment_carrier` | string | Dashboard |
| `shipment_tracking` | string | Dashboard |
| `shipment_logistics_notes` | string | Dashboard |
| `deployment_crew` | array of `{ "staff_id": string, "role": "operator" \| "chief_operator" }` | Dashboard after planning crew |

**Example `metadata` only (empty baseline):**

```json
{}
```

**Example with CS + shipment + crew (snake_case keys as above):**

```json
{
  "deployment_id": "770e8400-e29b-41d4-a716-446655440002",
  "visit_verifier_role": "chief_operator",
  "visit_secondary_staff_id": "aa0e8400-e29b-41d4-a716-446655440005",
  "visit_secondary_scheduled_date": "2026-04-10",
  "visit_secondary_role": "customer_success",
  "shipment_expected_delivery_date": "2026-04-20",
  "shipment_carrier": "In-house",
  "shipment_tracking": "LR-2026-0042",
  "shipment_logistics_notes": "Dock B, 9am–5pm",
  "deployment_crew": [
    { "staff_id": "880e8400-e29b-41d4-a716-446655440003", "role": "chief_operator" },
    { "staff_id": "990e8400-e29b-41d4-a716-446655440004", "role": "operator" }
  ]
}
```

---

## 6. Lead assignments (`ops.lead_assignments`)

**GET** ` /ops/leads/{lead_id}/assignments`  

Returned shape: list envelope → normalized to `{ items, total, has_more, ... }`.

**`OpsLeadAssignment`** (from `browser-api.ts`):

| Field | Type |
|-------|------|
| `id` | string |
| `lead_id` | string |
| `staff_id` | string |
| `assignment_type` | `"verifier"` \| `"shipper"` \| `"deployer"` |
| `scheduled_date` | string \| null |
| `scheduled_time` | string \| null |
| `status` | string |
| `notes` | string \| null |
| `metadata` | object |
| `created_at`, `updated_at` | string |

**Example `items` entry:**

```json
{
  "id": "b00e8400-e29b-41d4-a716-446655440010",
  "lead_id": "550e8400-e29b-41d4-a716-446655440000",
  "staff_id": "880e8400-e29b-41d4-a716-446655440003",
  "assignment_type": "verifier",
  "scheduled_date": "2026-04-05",
  "scheduled_time": null,
  "status": "scheduled",
  "notes": null,
  "metadata": {},
  "created_at": "2026-04-02T08:00:00Z",
  "updated_at": "2026-04-02T08:00:00Z"
}
```

The dashboard loads **one GET per lead ID in parallel** for all visible leads.

---

## 7. Staff directory

**GET** `/ops/staff`  

Response normalized to `{ items, total, has_more }`.

**`OpsStaff`:**

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "display_name": "Priya Singh",
  "phone": "+9198…",
  "email": "priya@example.com",
  "status": "active",
  "role": "ops_operator"
}
```

The pipeline pickers (CS, chief, deploy crew) use **this full list**, not only `ops_operator`.

(Optional) **GET** `/ops/staff?role=ops_operator` exists in the client but **the current Ops kanban page uses `GET /ops/staff` only**.

---

## 8. Locations (allocation map hubs)

**GET** `/ops/locations` (optional query `?active_only=true` — client may call without it)

**`OpsLocation`** (fields used on the map):

```json
{
  "id": "c00e8400-e29b-41d4-a716-446655440020",
  "slug": "chennai-hub",
  "name": "Chennai",
  "location_type": "warehouse",
  "org_id": "d00e8400-e29b-41d4-a716-446655440021",
  "is_active": true,
  "lat": 13.0827,
  "lng": 80.2707,
  "region": "TN",
  "shipping_address": null,
  "metadata": {}
}
```

`lat` / `lng` must be non-null for a pin to render.

---

## 9. Task checklists (settings side panel)

**GET** `/ops/task-checklists`  

Response: `{ "items": [ ... ] }` (or list envelope; client types `{ items: OpsTaskChecklist[] }`).

**`OpsTaskChecklist`:**

```json
{
  "id": "e00e8400-e29b-41d4-a716-446655440030",
  "assignment_type": "verifier",
  "title": "Site visit checklist",
  "items": [
    { "label": "Photo of factory gate", "required": true },
    { "label": "Owner ID verified", "required": false }
  ],
  "instructions": "Complete before marking verified.",
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T00:00:00Z"
}
```

**PUT** `/ops/task-checklists/{assignment_type}`  

Body (from client):

```json
{
  "title": "Site visit checklist",
  "items": [
    { "label": "Photo of factory gate", "required": true }
  ],
  "instructions": "Optional text"
}
```

`assignment_type` matches lead assignment types the ops app uses (`verifier`, `shipper`, `deployer`).

---

## 10. Pipeline endpoints (POST bodies and semantics)

All are **POST** ` /ops/leads/{lead_id}/...` unless noted. The client expects a **`DetailEnvelope`**-style JSON body with a **`data`** field containing the entity (see §1).

| Action | Path | Request body (JSON) | Returns (`data`) |
|--------|------|---------------------|------------------|
| Accept triage | `.../accept` | _(empty)_ | Updated `Lead` |
| Reject | `.../reject` | _(empty)_ | Updated `Lead` |
| Assign primary site visitor | `.../assign-verifier` | `{ "staff_id": "uuid", "scheduled_date": "YYYY-MM-DD", "notes": null }` | `LeadAssignment` |
| Verify site | `.../verify` | _(empty)_ | `Lead` → `pending_allocation`, creates site/factory |
| Allocate devices | `.../allocate` | `{ "source_location_id": "uuid", "operator_org_id": "uuid", "device_count": 8, "notes": null }` | `Lead` (+ backend sets `metadata.deployment_id`) |
| Assign shipper | `.../assign-shipper` | `{ "staff_id": "uuid", "scheduled_date": "YYYY-MM-DD", "notes": null }` | `LeadAssignment` — **not invoked by the admin kanban UI** (Shipment uses **Dispatch** / **Deliver** without a shipper step) |
| Dispatch | `.../dispatch` | _(empty)_ | `Lead` |
| Deliver | `.../deliver` | _(empty)_ | `Lead` → `pending_deployment` |
| Assign deployer | `.../assign-deployer` | `{ "staff_id": "uuid", "scheduled_date": "YYYY-MM-DD", "scheduled_time": "HH:MM", "notes": null }` | `LeadAssignment` |
| Deploy | `.../deploy` | _(empty)_ | `Lead` → `deployed` |

**Deploy precondition (dashboard + API):** **`metadata.deployment_crew`** must list at least one member with a non-empty **`staff_id`**. The UI disables **Confirm deployed** until crew is saved; **POST `.../deploy`** responds with **409** when the check fails.

**PATCH** `/ops/leads/{lead_id}` — partial update; dashboard sends **`metadata`** (and may send other lead fields). Preserve **`deployment_id`** and any server-owned keys when merging.

**Example POST allocate:**

```json
{
  "source_location_id": "c00e8400-e29b-41d4-a716-446655440020",
  "operator_org_id": "d00e8400-e29b-41d4-a716-446655440021",
  "device_count": 8,
  "notes": null
}
```

**Example POST assign-deployer:**

```json
{
  "staff_id": "880e8400-e29b-41d4-a716-446655440003",
  "scheduled_date": "2026-04-25",
  "scheduled_time": "09:30",
  "notes": null
}
```

---

## 11. GET list: leads

**GET** `/ops/leads`  

Query: optional `staff_id` (UUID) to filter by salesperson.

Normalized list response — **`items`** is an array of **`OpsLead`** objects (see §4).

---

## 12. What this page does **not** call

The following exist elsewhere in `browser-api.ts` but are **not** required for the current **Ops kanban + map + utilization + checklists** UI:

- `POST /ops/leads/{lead_id}/assign-shipper` (Shipment column uses **Dispatch** / **Deliver** only; no shipper assignment in UI)
- `GET /ops/shipments` (map transit lines are derived from **leads**, not this endpoint)
- `GET /ops/sites` for this page
- Sales-only `confirm` on this page (the kanban wires **accept/reject**; `confirm` is available in the client for other flows)

If you add new UI that needs them, extend this doc.

---

## 13. Source of truth in the repo

| Area | Path |
|------|------|
| TypeScript types & fetch URLs | `apps/buildai-dashboard/src/lib/api/browser-api.ts` |
| React Query hooks / invalidation | `apps/buildai-dashboard/src/lib/queries/operations.ts` |
| Column + metadata constants | `apps/buildai-dashboard/src/components/ops/kanban/ops-kanban-data.ts` |
| Standalone ops app (same contract) | `ops-dashboard` repo: `src/lib/api/browser-api.ts`, `src/components/ops/kanban/` |
| FastAPI routes (reference) | `apps/buildai-api/api/routers/ops/leads.py` |
| Envelope helpers | `apps/buildai-api/api/foundation/envelopes.py`, `pagination.py` |

---

## 14. Quick checklist for backend / mock servers

- [ ] `GET /v1/ops/leads` returns list envelope → normalized `items` / `total` / `has_more`
- [ ] Each lead has **`status`** from §3 and **`metadata`** object (may be `{}`)
- [ ] After allocate, lead has **`metadata.deployment_id`** string
- [ ] `GET /v1/ops/leads/{id}/assignments` returns verifier/shipper/deployer rows as needed
- [ ] `GET /v1/ops/staff` returns enough rows for dropdowns
- [ ] `GET /v1/ops/locations` returns hubs with **`lat`/`lng`**
- [ ] POST pipeline endpoints return **`{ "data": ... }`**
- [ ] **`POST .../deploy`** returns **409** when **`metadata.deployment_crew`** is empty, missing, or has no **`staff_id`**
- [ ] `PATCH` lead accepts **`metadata`** replacement consistent with merge rules in §5
