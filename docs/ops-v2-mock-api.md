# Ops v2 Mock API Reference

Mock backend for the Build AI admin **Operations** UI in **buildai-ops** (route **`/admin`**): kanban, map, utilization, checklists.

Serves static fixture data with in-memory mutations — no DB, no auth on the mock server. Intended for **frontend integration testing only**; state resets on restart.

**Base URL (local):** `http://localhost:8765`  
**Path prefix:** `/v2/ops`  
**Auth:** None required (omit `Authorization`; set `NEXT_PUBLIC_OPS_SKIP_AUTH=true` in this app — see below)

---

## Default backend in this repo

**buildai-ops** defaults to a **ngrok** API base when `NEXT_PUBLIC_BACKEND_API_URL` is unset (see `DEFAULT_TUNNEL_API_BASE_URL` in `src/lib/api/client.ts`). Use `.env.local` to override when the tunnel changes or to point at `:8765` / local Build AI.

---

## Wiring this repo to the mock

In **buildai-ops** repo root, copy `.env.local.example` → `.env.local` and use the **Ops v2 mock** block:

| Variable | Value for mock |
|----------|----------------|
| `NEXT_PUBLIC_BACKEND_API_URL` | `http://localhost:8765` |
| `NEXT_PUBLIC_OPS_API_GATEWAY_VERSION` | `v2` (optional — same as code default) |
| `NEXT_PUBLIC_OPS_SKIP_AUTH` | `true` |
| `NEXT_PUBLIC_MOCK_OPS_API` | `false` |

**Important:** `NEXT_PUBLIC_MOCK_OPS_API` must be **`false`** (or unset with care) when using the **HTTP** mock server. If it is `true`, this app uses **in-memory** fixtures in `src/lib/api/mock-responses.ts` and **never** calls port 8765.

The shared client (`src/lib/api/client.ts`) builds URLs as:

`{NEXT_PUBLIC_BACKEND_API_URL}/{NEXT_PUBLIC_OPS_API_GATEWAY_VERSION}/ops/...`  
e.g. `http://localhost:8765/v2/ops/leads`.

---

## Running the mock server

From the **Build AI monorepo** (where `apps/buildai-api` lives):

```bash
cd apps/buildai-api
uv run uvicorn api.mock_main:app --reload --port 8765
```

Health check:

```bash
curl http://localhost:8765/health
# {"status":"ok","server":"ops-mock"}
```

From the browser app you can call `fetchOpsServerHealth()` from `@/lib/api/client` or `@/lib/api/browser-api` (same helper). It requests `GET {NEXT_PUBLIC_BACKEND_API_URL}/health`, not under `/ops`.

OpenAPI UI: `http://localhost:8765/docs`

---

## Response envelope

All responses follow the standard Build AI envelope format, aligned with **v1**:

**List response:**

```json
{
  "data": [ ...items... ],
  "pagination": {
    "next_cursor": null,
    "has_more": false,
    "page_size": 50,
    "total_estimate": 12
  }
}
```

This app’s client normalises that to `{ items, total, has_more, page_size, next_cursor }`.

**Detail / action response:**

```json
{ "data": { ...entity... } }
```

---

## Lead status → kanban column

Matches the **buildai-ops** kanban (`ops-kanban-data.ts`):

| `status` | Column |
|----------|--------|
| `lead`, `confirmed`, `rejected`, `cancelled`, `deferred` | **Sales** (triage) |
| `accepted`, `pending_visit` | **Customer Success** |
| `pending_allocation` | **Allocation** |
| `pending_shipment` | **Shipment** |
| `pending_deployment`, `deployed` | **Deployment** |

`rejected` and `cancelled` are hidden from the board. `deployed` shows a **Live** badge.

---

## Endpoints

### Leads

#### `GET /v2/ops/leads`

List all leads. Optional `staff_id` query param filters by sales rep.

```bash
curl "http://localhost:8765/v2/ops/leads"
curl "http://localhost:8765/v2/ops/leads?staff_id=b0000001-0001-4000-8000-000000000001"
```

**Mock data:** 12 leads spread across all statuses — 2 `lead`, 1 `accepted`, 2 `pending_visit`, 2 `pending_allocation`, 2 `pending_shipment`, 2 `pending_deployment`, 1 `deployed`.

---

#### `PATCH /v2/ops/leads/{lead_id}`

Partial update. Sends any lead fields + `metadata`. Metadata is **merged additively** — server-owned keys like `deployment_id` are preserved even if not included in the patch.

```bash
curl -X PATCH "http://localhost:8765/v2/ops/leads/a0000001-0001-4000-8000-000000000008" \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "shipment_carrier": "BlueDart",
      "shipment_expected_delivery_date": "2026-04-20",
      "shipment_tracking": "BD-2026-0099"
    }
  }'
```

Returns the updated `Lead` in `{ "data": ... }`.

---

#### `GET /v2/ops/leads/{lead_id}/assignments`

List verifier / shipper / deployer assignments for a lead.

```bash
curl "http://localhost:8765/v2/ops/leads/a0000001-0001-4000-8000-000000000004/assignments"
```

---

### Pipeline actions

All pipeline actions are `POST` and return `{ "data": <entity> }`.

#### `POST /v2/ops/leads/{lead_id}/accept`

Move lead from triage to `accepted` (UI: **Customer Success** column). No request body.

```bash
curl -X POST "http://localhost:8765/v2/ops/leads/a0000001-0001-4000-8000-000000000001/accept"
```

---

#### `POST /v2/ops/leads/{lead_id}/reject`

Terminal rejection — lead hidden from board. No request body.

```bash
curl -X POST "http://localhost:8765/v2/ops/leads/a0000001-0001-4000-8000-000000000001/reject"
```

---

#### `POST /v2/ops/leads/{lead_id}/assign-verifier`

Assign a site verifier. Transitions lead to `pending_visit` and creates a `verifier` assignment record. Returns the assignment.

```bash
curl -X POST "http://localhost:8765/v2/ops/leads/a0000001-0001-4000-8000-000000000003/assign-verifier" \
  -H "Content-Type: application/json" \
  -d '{"staff_id": "b0000001-0001-4000-8000-000000000003", "scheduled_date": "2026-04-15", "notes": null}'
```

---

#### `POST /v2/ops/leads/{lead_id}/verify`

Mark site visit complete. Transitions to `pending_allocation`. No request body.

---

#### `POST /v2/ops/leads/{lead_id}/allocate`

Allocate devices. Transitions to `pending_shipment` and sets `metadata.deployment_id` (UUID generated by server). Returns the updated lead.

```bash
curl -X POST "http://localhost:8765/v2/ops/leads/a0000001-0001-4000-8000-000000000006/allocate" \
  -H "Content-Type: application/json" \
  -d '{
    "source_location_id": "e0000001-0001-4000-8000-000000000001",
    "operator_org_id": "f0000001-0001-4000-8000-000000000001",
    "device_count": 10,
    "notes": null
  }'
```

---

#### `POST /v2/ops/leads/{lead_id}/assign-shipper`

Assign a shipper. Creates a `shipper` assignment record. Returns the assignment.

**buildai-ops** does not use this in the Shipment column (flow is **Dispatch** / **Deliver** only); the client still exposes `assignOpsShipper` for integration tests and parity with production.

```bash
curl -X POST "http://localhost:8765/v2/ops/leads/a0000001-0001-4000-8000-000000000008/assign-shipper" \
  -H "Content-Type: application/json" \
  -d '{"staff_id": "b0000001-0001-4000-8000-000000000005", "scheduled_date": "2026-04-18", "notes": null}'
```

---

#### `POST /v2/ops/leads/{lead_id}/dispatch`

Mark equipment dispatched. Status stays `pending_shipment`. No request body. Returns the lead.

---

#### `POST /v2/ops/leads/{lead_id}/deliver`

Confirm delivery. Transitions to `pending_deployment`. No request body.

---

#### `POST /v2/ops/leads/{lead_id}/assign-deployer`

Assign a deployer with date and time. Creates a `deployer` assignment. Returns the assignment.

```bash
curl -X POST "http://localhost:8765/v2/ops/leads/a0000001-0001-4000-8000-000000000010/assign-deployer" \
  -H "Content-Type: application/json" \
  -d '{
    "staff_id": "b0000001-0001-4000-8000-000000000006",
    "scheduled_date": "2026-04-25",
    "scheduled_time": "09:30",
    "notes": null
  }'
```

---

#### `POST /v2/ops/leads/{lead_id}/deploy`

Mark deployment live — terminal success state. Transitions to `deployed`. No request body.

**Precondition:** `metadata.deployment_crew` must contain at least one entry with a non-empty `staff_id`. Returns **409** otherwise. The dashboard UI disables **Confirm deployed** until crew is saved; the API enforces this independently.

```bash
# Works — lead has deployment_crew in metadata
curl -X POST "http://localhost:8765/v2/ops/leads/a0000001-0001-4000-8000-000000000010/deploy"

# 409 — lead has no deployment_crew (e.g. freshly delivered lead)
curl -X POST "http://localhost:8765/v2/ops/leads/a0000001-0001-4000-8000-000000000001/deploy"
```

The in-app mock (`NEXT_PUBLIC_MOCK_OPS_API` on localhost) applies the same **409** rule via `OpsMockHttpError`.

---

### Staff

#### `GET /v2/ops/staff`

Full staff directory for all pipeline pickers. Optional `?role=` filter.

```bash
curl "http://localhost:8765/v2/ops/staff"
curl "http://localhost:8765/v2/ops/staff?role=customer_success"
```

**Mock data:** 8 staff — 2 `ops_sales`, 3 `customer_success`, 1 `chief_operator`, 2 `ops_operator`.

---

### Locations

#### `GET /v2/ops/locations`

Warehouse hub locations for the allocation map and source pickers. Optional `?active_only=true`.

```bash
curl "http://localhost:8765/v2/ops/locations"
curl "http://localhost:8765/v2/ops/locations?active_only=true"
```

**Mock data:** 4 hubs — Chennai, Mumbai, Delhi NCR (active), Bangalore (inactive). All have `lat`/`lng`.

---

### Task checklists

#### `GET /v2/ops/task-checklists`

All task checklists for the settings side panel.

**Mock data:** 3 checklists — `verifier` (6 items), `shipper` (5 items), `deployer` (7 items).

---

#### `PUT /v2/ops/task-checklists/{assignment_type}`

Create or replace a checklist for `verifier`, `shipper`, or `deployer`. Returns the upserted checklist.

```bash
curl -X PUT "http://localhost:8765/v2/ops/task-checklists/verifier" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Site visit checklist",
    "items": [
      {"label": "Photo of factory gate", "required": true},
      {"label": "Owner ID verified", "required": true}
    ],
    "instructions": "Complete before marking verified."
  }'
```

---

## Mock fixture IDs (examples)

### Leads (by status)

| Factory | Status | ID |
|---------|--------|----|
| Acme Textiles | `lead` | `a0000001-0001-4000-8000-000000000001` |
| Sunrise Knits | `lead` | `a0000001-0001-4000-8000-000000000002` |
| Bharat Spinning Mills | `accepted` | `a0000001-0001-4000-8000-000000000003` |
| Velavan Exports | `pending_visit` | `a0000001-0001-4000-8000-000000000004` |
| Gujarat Silk House | `pending_visit` | `a0000001-0001-4000-8000-000000000005` |
| Erode Cotton Corp | `pending_allocation` | `a0000001-0001-4000-8000-000000000006` |
| Rajkot Ceramics | `pending_allocation` | `a0000001-0001-4000-8000-000000000007` |
| Salem Steel Works | `pending_shipment` | `a0000001-0001-4000-8000-000000000008` |
| Kanpur Leather Co | `pending_shipment` | `a0000001-0001-4000-8000-000000000009` |
| Madurai Handlooms | `pending_deployment` | `a0000001-0001-4000-8000-000000000010` |
| Jaipur Gems & Jewels | `pending_deployment` | `a0000001-0001-4000-8000-000000000011` |
| Chennai Auto Parts | `deployed` | `a0000001-0001-4000-8000-000000000012` |

### Staff

| Name | Role | ID |
|------|------|----|
| Priya Singh | `ops_sales` | `b0000001-0001-4000-8000-000000000001` |
| Arjun Nair | `ops_sales` | `b0000001-0001-4000-8000-000000000002` |
| Meena Rao | `customer_success` | `b0000001-0001-4000-8000-000000000003` |
| Vikram Desai | `customer_success` | `b0000001-0001-4000-8000-000000000004` |
| Kavitha Pillai | `customer_success` | `b0000001-0001-4000-8000-000000000005` |
| Rajesh Iyer | `chief_operator` | `b0000001-0001-4000-8000-000000000006` |
| Suresh Babu | `ops_operator` | `b0000001-0001-4000-8000-000000000007` |
| Ananya Krishnan | `ops_operator` | `b0000001-0001-4000-8000-000000000008` |

### Locations

| Name | Active | ID |
|------|--------|----|
| Chennai | Yes | `e0000001-0001-4000-8000-000000000001` |
| Mumbai | Yes | `e0000001-0001-4000-8000-000000000002` |
| Delhi NCR | Yes | `e0000001-0001-4000-8000-000000000003` |
| Bangalore | No | `e0000001-0001-4000-8000-000000000004` |

---

## Frontend integration notes

1. **Base URL** — set API base to `http://localhost:8765` in **buildai-ops** via `NEXT_PUBLIC_BACKEND_API_URL`.
2. **Version prefix** — all paths are `/v2/ops/...`; the client builds `{base}/{NEXT_PUBLIC_OPS_API_GATEWAY_VERSION}/ops/...` and **defaults to `v2`**. Set `NEXT_PUBLIC_OPS_API_GATEWAY_VERSION=v1` only for legacy gateways.
3. **No auth** — omit `Authorization`; set `NEXT_PUBLIC_OPS_SKIP_AUTH=true`.
4. **State resets on restart** — mutations persist only in server memory. Restart uvicorn for clean fixtures.
5. **CORS** — the mock allows all origins; no proxy required for local dev.
6. **In-app mock** — `NEXT_PUBLIC_MOCK_OPS_API=true` uses `src/lib/api/mock-responses.ts` and does not call port 8765. Set `false` when using the HTTP mock.

---

## buildai-ops client mapping (v2 mock)

| Mock endpoint | `browser-api.ts` | `operations.ts` hook |
|---------------|------------------|----------------------|
| `GET /ops/leads` | `fetchOpsLeads` | `useOpsLeads` |
| `PATCH /ops/leads/:id` | `updateOpsLead` | `useUpdateOpsLead`, `useMergeOpsLeadMetadata`, `useVerifyOpsLeadWithCount` |
| `GET /ops/leads/:id/assignments` | `fetchOpsLeadAssignments` | `useOpsLeadAssignments` |
| `POST .../accept` | `acceptOpsLead` | `useAcceptOpsLead` |
| `POST .../reject` | `rejectOpsLead` | `useRejectOpsLead` |
| `POST .../assign-verifier` | `assignOpsVerifier` | `useAssignOpsVerifier` |
| `POST .../verify` | `verifyOpsLead` | `useVerifyOpsLead`, `useVerifyOpsLeadWithCount` |
| `POST .../allocate` | `allocateOpsLead` | `useAllocateOpsLead` |
| `POST .../assign-shipper` | `assignOpsShipper` | `useAssignOpsShipper` (no kanban UI) |
| `POST .../dispatch` | `dispatchOpsLead` | `useDispatchOpsLead` |
| `POST .../deliver` | `deliverOpsLead` | `useDeliverOpsLead` |
| `POST .../assign-deployer` | `assignOpsDeployer` | `useAssignOpsDeployer` |
| `POST .../deploy` | `deployOpsLead` | `useDeployOpsLead` |
| `GET /ops/staff` | `fetchOpsStaff`, `fetchOpsStaffByRole` | `useOpsStaff`, `useOpsOperators` |
| `GET /ops/locations` | `fetchOpsLocations` | `useOpsLocations` |
| `GET/PUT /ops/task-checklists` | `fetchOpsTaskChecklists`, `upsertOpsTaskChecklist` | `useOpsTaskChecklists`, `useUpsertOpsTaskChecklist` |
| `GET /health` (host root) | `fetchOpsServerHealth` | — |

Not on the v2 mock (production / extended API only): `confirmOpsLead`, `cancelOpsLead`, `deferOpsLead`, staff-assignments CRUD, `fetchOpsSites`, `fetchOpsShipments`.

---

## Source files (Build AI monorepo)

| What | Path |
|------|------|
| Mock server entry point | `apps/buildai-api/api/mock_main.py` |
| Router package | `apps/buildai-api/api/routers/ops_mock/` |
| In-memory store | `apps/buildai-api/api/routers/ops_mock/store.py` |
| Lead endpoints | `apps/buildai-api/api/routers/ops_mock/leads.py` |
| Fixture JSON files | `apps/buildai-api/api/routers/ops_mock/fixtures/` |

This **buildai-ops** repo consumes the API only; Python mock lives in **Build AI** `apps/buildai-api`.
