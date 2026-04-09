# Ops v2 Mock API Reference

Mock backend for the **ops-dashboard** Operations UI (kanban, map, utilization, checklists).

Serves static fixture data with in-memory mutations — typically no DB, no auth. Intended for **frontend integration testing only**; state resets on restart.

**Base URL (local):** `http://localhost:8765`  
**Path prefix:** `/v2/ops`  
**Auth:** None required (omit `Authorization`; set `NEXT_PUBLIC_OPS_SKIP_AUTH=true` in this app — see below)

---

## Default backend in this repo

**ops-dashboard** defaults to a **ngrok** API base when `NEXT_PUBLIC_BACKEND_API_URL` is unset (see `DEFAULT_TUNNEL_API_BASE_URL` in `src/lib/api/client.ts`). Use `.env.local` to override when the tunnel changes or to point at `:8765` / local Build AI.

---

## Wiring this repo to the mock

In **ops-dashboard** root, copy `.env.local.example` → `.env.local` and use the **Ops v2 mock** block:

| Variable | Value for mock |
|----------|----------------|
| `NEXT_PUBLIC_BACKEND_API_URL` | `http://localhost:8765` |
| `NEXT_PUBLIC_OPS_API_GATEWAY_VERSION` | `v2` |
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

If your checkout does not yet include `api.mock_main`, add or generate the mock app per your backend team’s instructions — this doc describes the **contract** the ops-dashboard client expects.

Health check:

```bash
curl http://localhost:8765/health
# e.g. {"status":"ok","server":"ops-mock"}
```

OpenAPI UI: `http://localhost:8765/docs` (when the server exposes it).

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

Matches the **ops-dashboard** kanban (`ops-kanban-data.ts`):

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

**Example mock data:** 12 leads across statuses — 2 `lead`, 1 `accepted`, 2 `pending_visit`, 2 `pending_allocation`, 2 `pending_shipment`, 2 `pending_deployment`, 1 `deployed`.

---

#### `PATCH /v2/ops/leads/{lead_id}`

Partial update. Sends any lead fields + `metadata`. Prefer **merging** metadata server-side and preserving server-owned keys (e.g. `deployment_id`).

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

Move lead to `accepted` (UI: **Customer Success** column). No body.

```bash
curl -X POST "http://localhost:8765/v2/ops/leads/a0000001-0001-4000-8000-000000000001/accept"
```

---

#### `POST /v2/ops/leads/{lead_id}/reject`

Terminal — hidden from board. No body.

```bash
curl -X POST "http://localhost:8765/v2/ops/leads/a0000001-0001-4000-8000-000000000001/reject"
```

---

#### `POST /v2/ops/leads/{lead_id}/assign-verifier`

Creates `verifier` assignment; transitions toward `pending_visit` as per your backend rules.

```bash
curl -X POST "http://localhost:8765/v2/ops/leads/a0000001-0001-4000-8000-000000000003/assign-verifier" \
  -H "Content-Type: application/json" \
  -d '{"staff_id": "b0000001-0001-4000-8000-000000000003", "scheduled_date": "2026-04-15", "notes": null}'
```

---

#### `POST /v2/ops/leads/{lead_id}/verify`

Mark site visit complete → `pending_allocation`. No body.

---

#### `POST /v2/ops/leads/{lead_id}/allocate`

Allocate devices → `pending_shipment`; set `metadata.deployment_id`.

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

Optional on the API; **this ops-dashboard UI does not call it** (Shipment uses **Dispatch** / **Deliver** without assigning shipper staff).

---

#### `POST /v2/ops/leads/{lead_id}/dispatch`

Dispatched; status typically stays `pending_shipment`. No body.

---

#### `POST /v2/ops/leads/{lead_id}/deliver`

Delivery confirmed → `pending_deployment`. No body.

---

#### `POST /v2/ops/leads/{lead_id}/assign-deployer`

Schedule primary deployer; creates `deployer` assignment.

---

#### `POST /v2/ops/leads/{lead_id}/deploy`

Mark live → `deployed`. No body.

Recommended: return **409** if `metadata.deployment_crew` has no valid `staff_id` entries (matches kanban **Confirm deployed** guard).

---

### Staff

#### `GET /v2/ops/staff`

Directory for pickers. Optional `?role=`.

```bash
curl "http://localhost:8765/v2/ops/staff"
```

---

### Locations

#### `GET /v2/ops/locations`

Hubs for the map / allocate dialog. Optional `?active_only=true`.

---

### Task checklists

#### `GET /v2/ops/task-checklists`

#### `PUT /v2/ops/task-checklists/{assignment_type}`

`assignment_type`: `verifier` | `shipper` | `deployer`.

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

### Staff (examples)

| Name | Role | ID |
|------|------|----|
| Priya Singh | `ops_sales` | `b0000001-0001-4000-8000-000000000001` |
| Arjun Nair | `ops_sales` | `b0000001-0001-4000-8000-000000000002` |
| Meena Rao | `customer_success` | `b0000001-0001-4000-8000-000000000003` |
| … | … | … |

### Locations (examples)

| Name | Active | ID |
|------|--------|----|
| Chennai | Yes | `e0000001-0001-4000-8000-000000000001` |
| Mumbai | Yes | `e0000001-0001-4000-8000-000000000002` |

---

## Frontend integration checklist

1. **Base URL** — `NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8765`
2. **Version segment** — `NEXT_PUBLIC_OPS_API_GATEWAY_VERSION=v2` (not `v1`)
3. **Auth** — `NEXT_PUBLIC_OPS_SKIP_AUTH=true` for the no-auth mock
4. **Disable in-app mocks** — `NEXT_PUBLIC_MOCK_OPS_API=false` when using the HTTP mock
5. **CORS** — mock should allow the ops-dashboard origin (e.g. `http://localhost:3001`)

---

## Backend source (monorepo)

When implemented, typical layout in **Build AI** `apps/buildai-api`:

| What | Path (example) |
|------|----------------|
| Mock server entry | `api/mock_main.py` |
| Router package | `api/routers/ops_mock/` |
| Store / fixtures | `api/routers/ops_mock/store.py`, `fixtures/` |

This **ops-dashboard** repo only consumes the API; it does not ship the Python mock.
