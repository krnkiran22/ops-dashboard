/**
 * Mock API payloads for local dev when the ops backend is not reachable.
 * Shapes match the real API types in `staff.ts` so the UI renders identically
 * when you switch to a live backend.
 */

import type {
  Lead,
  LeadAssignment,
  SelfRegisterStaffRequest,
  SelfRegisterStaffResponse,
  StaffAssignment,
  StaffClaimCompleteResponse,
  StaffClaimResolveResponse,
  StaffProfile,
  TaskChecklist,
} from "@/lib/api/staff";

/**
 * Thrown from `resolveMockOpsApi` so the browser client can surface HTTP status codes
 * (e.g. 409) matching the v2 ops mock server.
 */
export class OpsMockHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "OpsMockHttpError";
  }
}

/** Today's date in local preview — use fixed dates so the "Today" label matches the mock. */
function mockTodayIsoDate(): string {
  return "2026-04-09";
}

function mockTomorrowIsoDate(): string {
  return "2026-04-10";
}

const MOCK_STAFF_ID = "mock-staff-001";

export const mockStaffProfile: StaffProfile = {
  id: MOCK_STAFF_ID,
  display_name: "Mock Operator",
  phone: "+919876543210",
  status: "active",
  role: "ops_operator",
};

let mockLeadAssignments: LeadAssignment[] = [
  {
    id: "mock-la-v1",
    lead_id: "mock-lead-1",
    staff_id: MOCK_STAFF_ID,
    assignment_type: "verifier",
    scheduled_date: mockTodayIsoDate(),
    scheduled_time: "09:30 — 18:00",
    status: "scheduled",
    notes: null,
    metadata: {
      factory_name: "Krishna Textiles — Unit",
      address: "Peenya Industrial Area, Bengaluru, Karnataka",
      worker_count: 120,
      device_count: 45,
      industry: "Garment",
      shifts: 2,
      contact_name: "Ramesh Kumar",
      contact_phone: "+919901112233",
      lat: 13.0281,
      lng: 77.5058,
      google_maps_url: "https://www.google.com/maps/search/?api=1&query=13.0281,77.5058",
      protocols: "ISO safety briefing required at gate.",
      assigned_operators: [
        { name: "Arjun Mehta", role: "Lead verifier", phone: "+919845612301" },
        { name: "Kavitha Nair", role: "Verifier", phone: "+919876512302" },
        { name: "Suresh Iyer", role: "Safety observer", phone: "+919912398877" },
      ],
      delivery_services: [
        {
          name: "Blue Dart Express",
          service_type: "Dox / samples",
          tracking_id: "BD782934561IN",
          estimated_delivery: mockTomorrowIsoDate(),
        },
        {
          name: "Delhivery Surface",
          service_type: "B2B linehaul to Peenya",
          tracking_id: "DLV-4412098-KA",
          estimated_delivery: mockTodayIsoDate(),
        },
      ],
    },
    created_at: "2026-04-09T10:00:00.000Z",
    updated_at: "2026-04-09T10:00:00.000Z",
  },
  {
    id: "mock-la-s1",
    lead_id: "mock-lead-2",
    staff_id: MOCK_STAFF_ID,
    assignment_type: "shipper",
    scheduled_date: mockTomorrowIsoDate(),
    scheduled_time: "11:00",
    status: "scheduled",
    notes: null,
    metadata: {
      factory_name: "South Logistics Hub",
      address: "Electronic City Phase 1, Bengaluru",
      worker_count: 85,
      device_count: 20,
      industry: "Warehouse",
      lat: 12.8456,
      lng: 77.6603,
      contact_name: "Dept. Logistics",
      contact_phone: "+919887776655",
      assigned_operators: [
        { name: "Rahul Khanna", role: "Shipper lead", phone: "+919933445566" },
        { name: "Divya Menon", role: "Load supervisor", phone: "+919922334411" },
      ],
      delivery_services: [
        {
          name: "Gati-KWE Express",
          service_type: "FTL Bengaluru corridor",
          tracking_id: "GATI-90817264",
          estimated_delivery: mockTomorrowIsoDate(),
        },
        {
          name: "DTDC Cargo",
          service_type: "Palletised freight",
          tracking_id: "DTDCZ5544332211",
          estimated_delivery: mockTomorrowIsoDate(),
        },
        {
          name: "Amazon Transportation Services",
          service_type: "Middle mile to hub",
          tracking_id: "ATS-IN7Z-882190",
          estimated_delivery: mockTodayIsoDate(),
        },
      ],
    },
    created_at: "2026-04-09T10:00:00.000Z",
    updated_at: "2026-04-09T10:00:00.000Z",
  },
  {
    id: "mock-la-d1",
    lead_id: "mock-lead-3",
    staff_id: MOCK_STAFF_ID,
    assignment_type: "deployer",
    scheduled_date: mockTodayIsoDate(),
    scheduled_time: "14:00",
    status: "confirmed",
    notes: null,
    metadata: {
      factory_name: "Precision Components Pvt Ltd",
      address: "Whitefield Industrial Zone, Bengaluru",
      worker_count: 200,
      device_count: 80,
      lat: 12.9698,
      lng: 77.7499,
      contact_name: "Plant Manager",
      contact_phone: "+919776655443",
      assigned_operators: [
        { name: "Nikhil Bhatt", role: "Deployment lead", phone: "+919955667788" },
        { name: "Deepa Srinivasan", role: "Field engineer", phone: "+919944556677" },
        { name: "Imran Qureshi", role: "Network installer", phone: "+919933221100" },
      ],
      delivery_services: [
        {
          name: "Mahindra Logistics — MLL",
          service_type: "White-glove rack delivery",
          tracking_id: "MLL-WH-229184",
          estimated_delivery: mockTodayIsoDate(),
        },
        {
          name: "Safexpress",
          service_type: "Project cargo",
          tracking_id: "SFX-BLR-771902",
          estimated_delivery: mockTomorrowIsoDate(),
        },
      ],
    },
    created_at: "2026-04-09T10:00:00.000Z",
    updated_at: "2026-04-09T10:00:00.000Z",
  },
];

const mockStaffAssignmentsFallback: StaffAssignment[] = [
  {
    id: "mock-sa-1",
    staff_id: MOCK_STAFF_ID,
    site_id: "mock-site-1",
    assignment_date: mockTodayIsoDate(),
    status: "scheduled",
    notes: null,
    site_name: "Fallback Site (staff-assignments API)",
    site_address: "Only used when lead assignments are empty.",
    metadata: {
      worker_count: 50,
      lat: 12.9716,
      lng: 77.5946,
      assigned_operators: [
        { name: "Harish Gowda", role: "Site lead", phone: "+919812300445" },
        { name: "Lakshmi Prasad", role: "Verifier", phone: "+919876500332" },
      ],
      delivery_services: [
        {
          name: "Ecom Express",
          service_type: "Last-mile handover",
          tracking_id: "ECOM-IN882190334",
          estimated_delivery: mockTodayIsoDate(),
        },
      ],
    },
  },
];

let mockTaskChecklists: Record<string, TaskChecklist> = {
  verifier: {
    id: "chk-verifier",
    assignment_type: "verifier",
    title: "Verifier checklist",
    instructions: "Complete before leaving the site.",
    items: [
      { label: "Verify headcount vs. roster", required: true },
      { label: "Photograph installed devices", required: true },
      { label: "Sign off with site POC", required: false },
    ],
  },
  shipper: {
    id: "chk-shipper",
    assignment_type: "shipper",
    title: "Shipment checklist",
    instructions: null,
    items: [
      { label: "Confirm seal numbers", required: true },
      { label: "Capture delivery note", required: true },
    ],
  },
  deployer: {
    id: "chk-deployer",
    assignment_type: "deployer",
    title: "Deployment checklist",
    instructions: "Escalate if network is unavailable.",
    items: [
      { label: "Run connectivity test", required: true },
      { label: "Register devices in ops console", required: true },
      { label: "Handover to operations", required: false },
    ],
  },
};

const MOCK_STAFF_ROSTER = [
  {
    id: MOCK_STAFF_ID,
    display_name: "Kaushal (chief operator)",
    phone: null as string | null,
    email: null as string | null,
    status: "active",
    role: "ops_operator",
  },
  {
    id: "mock-cs-1",
    display_name: "Nikhil (CS)",
    phone: null as string | null,
    email: null as string | null,
    status: "active",
    role: "ops_sales",
  },
  {
    id: "mock-sales-1",
    display_name: "Priya (Sales)",
    phone: null as string | null,
    email: null as string | null,
    status: "active",
    role: "ops_sales",
  },
];

const MOCK_LOGISTICS_LOCATIONS = [
  {
    id: "loc-blore-hub",
    slug: "blore-hub",
    name: "Bengaluru Hub",
    location_type: "hub",
    org_id: "org-mock-1",
    is_active: true,
    lat: 12.9716,
    lng: 77.5946,
    region: "IN-KA",
    shipping_address: "Peenya, Bengaluru",
    metadata: {} as Record<string, unknown>,
  },
  {
    id: "loc-chennai-hub",
    slug: "chennai-hub",
    name: "Chennai Hub",
    location_type: "hub",
    org_id: "org-mock-2",
    is_active: true,
    lat: 13.0827,
    lng: 80.2707,
    region: "IN-TN",
    shipping_address: "Ambattur, Chennai",
    metadata: {} as Record<string, unknown>,
  },
];

/** V2 `/v2/ops/factories` — mirrors ops-v2 mock fixture IDs. */
const MOCK_OPS_FACTORIES = [
  {
    site_id: "c1000001-0001-4000-8000-000000000001",
    factory_name: "Erode Cotton Corp",
    production_type: "spinning",
    worker_count: 180,
    team_lead_staff_id: "b0000001-0001-4000-8000-000000000006",
    team_cs_staff_id: "b0000001-0001-4000-8000-000000000003",
    pipeline_status: "pending_allocation",
    industry: "Textile",
    shifts: 2,
  },
  {
    site_id: "c1000001-0001-4000-8000-000000000002",
    factory_name: "Rajkot Ceramics",
    production_type: "ceramics",
    worker_count: 95,
    team_lead_staff_id: "b0000001-0001-4000-8000-000000000006",
    team_cs_staff_id: "b0000001-0001-4000-8000-000000000004",
    pipeline_status: "pending_allocation",
    industry: "Ceramics",
    shifts: 2,
  },
  {
    site_id: "c1000001-0001-4000-8000-000000000003",
    factory_name: "Salem Steel Works",
    production_type: "steel",
    worker_count: 220,
    team_lead_staff_id: "b0000001-0001-4000-8000-000000000006",
    team_cs_staff_id: "b0000001-0001-4000-8000-000000000005",
    pipeline_status: "pending_shipment",
    industry: "Steel",
    shifts: 3,
  },
  {
    site_id: "c1000001-0001-4000-8000-000000000004",
    factory_name: "Kanpur Leather Co",
    production_type: "leather",
    worker_count: 140,
    team_lead_staff_id: "b0000001-0001-4000-8000-000000000006",
    team_cs_staff_id: "b0000001-0001-4000-8000-000000000003",
    pipeline_status: "pending_shipment",
    industry: "Leather",
    shifts: 2,
  },
  {
    site_id: "c1000001-0001-4000-8000-000000000005",
    factory_name: "Madurai Handlooms",
    production_type: "textile",
    worker_count: 160,
    team_lead_staff_id: "b0000001-0001-4000-8000-000000000006",
    team_cs_staff_id: "b0000001-0001-4000-8000-000000000005",
    pipeline_status: "pending_deployment",
    industry: "Handloom",
    shifts: 2,
  },
  {
    site_id: "c1000001-0001-4000-8000-000000000006",
    factory_name: "Jaipur Gems & Jewels",
    production_type: "jewellery",
    worker_count: 90,
    team_lead_staff_id: "b0000001-0001-4000-8000-000000000006",
    team_cs_staff_id: "b0000001-0001-4000-8000-000000000004",
    pipeline_status: "pending_deployment",
    industry: "Jewellery",
    shifts: 1,
  },
  {
    site_id: "c1000001-0001-4000-8000-000000000007",
    factory_name: "Chennai Auto Parts",
    production_type: "automotive",
    worker_count: 300,
    team_lead_staff_id: "b0000001-0001-4000-8000-000000000006",
    team_cs_staff_id: "b0000001-0001-4000-8000-000000000003",
    pipeline_status: "deployed",
    industry: "Automotive",
    shifts: 3,
  },
];

const MOCK_OPS_CENTRES = [
  {
    id: "e0000001-0001-4000-8000-000000000001",
    name: "Chennai",
    location_type: "warehouse",
    is_active: true,
    lat: 13.0827,
    lng: 80.2707,
    device_count: 42,
  },
  {
    id: "e0000001-0001-4000-8000-000000000002",
    name: "Mumbai",
    location_type: "warehouse",
    is_active: true,
    lat: 19.076,
    lng: 72.8777,
    device_count: 28,
  },
  {
    id: "e0000001-0001-4000-8000-000000000003",
    name: "Delhi NCR",
    location_type: "hub",
    is_active: true,
    lat: 28.6139,
    lng: 77.209,
    device_count: 35,
  },
];

const MOCK_SHIPMENTS_BY_DEPLOYMENT: Record<string, Record<string, unknown>> = {
  "d0000001-0001-4000-8000-000000000001": {
    id: "ship-1",
    vendor: "Blue Dart",
    transport_mode: "surface",
    poc_staff_id: "b0000001-0001-4000-8000-000000000007",
    departed_at: "2026-04-08T06:00:00.000Z",
    eta: "2026-04-12",
    tracking_reference: "BD-2026-0099",
    allocation_id: "alloc-mock-1",
    status: "in_transit",
  },
  "d0000001-0001-4000-8000-000000000002": {
    id: "ship-2",
    vendor: "Delhivery",
    transport_mode: "ftl",
    poc_staff_id: "b0000001-0001-4000-8000-000000000008",
    departed_at: "2026-04-07T10:00:00.000Z",
    eta: "2026-04-11",
    tracking_reference: "DLV-4412098",
    allocation_id: "alloc-mock-2",
    status: "dispatched",
  },
  "d0000001-0001-4000-8000-000000000003": {
    id: "ship-3",
    vendor: "Gati-KWE",
    transport_mode: "ltl",
    eta: "2026-04-09",
    tracking_reference: "GATI-90817264",
    allocation_id: "alloc-mock-3",
    status: "delivered",
  },
  "d0000001-0001-4000-8000-000000000004": {
    id: "ship-4",
    vendor: "Safexpress",
    transport_mode: "surface",
    eta: "2026-04-10",
    tracking_reference: "SFX-BLR-771902",
    allocation_id: "alloc-mock-4",
    status: "delivered",
  },
  "d0000001-0001-4000-8000-000000000005": {
    id: "ship-5",
    vendor: "Mahindra Logistics",
    transport_mode: "white_glove",
    eta: "2026-04-01",
    tracking_reference: "MLL-CH-991200",
    allocation_id: "alloc-mock-5",
    status: "delivered",
  },
};

const MOCK_SITE_V2_SUMMARY: Record<string, Record<string, unknown>> = {
  "c1000001-0001-4000-8000-000000000007": {
    site_id: "c1000001-0001-4000-8000-000000000007",
    factory_name: "Chennai Auto Parts",
    pipeline_status: "deployed",
    worker_count: 300,
    industry: "Automotive",
    shifts: 3,
    team_lead: {
      id: "b0000001-0001-4000-8000-000000000006",
      display_name: "Rajesh Iyer",
    },
    team_cs: {
      id: "b0000001-0001-4000-8000-000000000003",
      display_name: "Meena Rao",
    },
    devices_deployed: 16,
    recent_allocations: [
      { id: "alloc-1", device_count: 8, source: "Chennai" },
    ],
  },
  "c1000001-0001-4000-8000-000000000001": {
    site_id: "c1000001-0001-4000-8000-000000000001",
    factory_name: "Erode Cotton Corp",
    pipeline_status: "pending_allocation",
    worker_count: 180,
    industry: "Textile",
    shifts: 2,
    team_lead: {
      id: "b0000001-0001-4000-8000-000000000006",
      display_name: "Rajesh Iyer",
    },
    team_cs: {
      id: "b0000001-0001-4000-8000-000000000003",
      display_name: "Meena Rao",
    },
    devices_deployed: 0,
    recent_allocations: [],
  },
};

let mockCrmAssignmentsByLeadId: Record<string, LeadAssignment[]> = {
  "mock-lead-map-1": [
    {
      id: "crm-la-1",
      lead_id: "mock-lead-map-1",
      staff_id: MOCK_STAFF_ID,
      assignment_type: "verifier",
      scheduled_date: mockTodayIsoDate(),
      scheduled_time: null,
      status: "scheduled",
      notes: null,
      metadata: {},
      created_at: "2026-04-01T00:00:00.000Z",
      updated_at: "2026-04-01T00:00:00.000Z",
    },
  ],
  "mock-pipe-deploy": [
    {
      id: "crm-la-dep",
      lead_id: "mock-pipe-deploy",
      staff_id: MOCK_STAFF_ID,
      assignment_type: "deployer",
      scheduled_date: mockTodayIsoDate(),
      scheduled_time: "10:00",
      status: "scheduled",
      notes: null,
      metadata: {},
      created_at: "2026-04-08T00:00:00.000Z",
      updated_at: "2026-04-08T00:00:00.000Z",
    },
  ],
};

let mockLeads: Lead[] = [
  {
    id: "mock-lead-map-1",
    staff_id: MOCK_STAFF_ID,
    site_id: "site-1",
    factory_name: "Coastal Manufacturing",
    address: "Mysore Rd Industrial Area, Bengaluru",
    city: "Bengaluru",
    state: "Karnataka",
    postal_code: "560026",
    country: "IN",
    worker_count: 150,
    contact_name: "Anita S",
    contact_phone: "+919922334455",
    lat: 12.9141,
    lng: 77.5028,
    planned_start: "2026-04-15",
    planned_end: null,
    device_count: 60,
    industry: "Garment",
    shifts: 2,
    workers_per_shift: 75,
    status: "pending_visit",
    notes: null,
    metadata: { days: 0, lat: 12.9141, lng: 77.5028 },
    created_at: "2026-04-01T00:00:00.000Z",
    updated_at: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "mock-lead-map-2",
    staff_id: "mock-sales-1",
    site_id: "site-2",
    factory_name: "Highland Foods",
    address: "Yelahanka, Bengaluru",
    city: "Bengaluru",
    state: "Karnataka",
    postal_code: "560064",
    country: "IN",
    worker_count: 95,
    contact_name: "POC",
    contact_phone: "+919811223344",
    lat: 13.1007,
    lng: 77.5963,
    planned_start: null,
    planned_end: null,
    device_count: 30,
    industry: "Food",
    status: "confirmed",
    notes: null,
    metadata: { days: 0 },
    created_at: "2026-04-09T00:00:00.000Z",
    updated_at: "2026-04-09T00:00:00.000Z",
  },
  {
    id: "mock-pipe-alloc",
    staff_id: "mock-sales-1",
    site_id: null,
    factory_name: "Coromandel Components",
    address: "Ambattur Industrial Estate",
    city: "Chennai",
    state: "Tamil Nadu",
    postal_code: "600058",
    country: "IN",
    worker_count: 200,
    contact_name: "Karthik",
    contact_phone: "+919812345678",
    lat: 13.1143,
    lng: 80.1548,
    planned_start: null,
    planned_end: null,
    device_count: 80,
    industry: "Auto",
    status: "pending_allocation",
    notes: null,
    metadata: {},
    created_at: "2026-04-05T00:00:00.000Z",
    updated_at: "2026-04-05T00:00:00.000Z",
  },
  {
    id: "mock-pipe-ship",
    staff_id: "mock-sales-1",
    site_id: null,
    factory_name: "Deccan Packaging",
    address: "HITEC City",
    city: "Hyderabad",
    state: "Telangana",
    postal_code: "500081",
    country: "IN",
    worker_count: 110,
    contact_name: "Sanjay",
    contact_phone: "+919876543210",
    lat: 17.4474,
    lng: 78.3762,
    planned_start: null,
    planned_end: null,
    device_count: 40,
    industry: "Packaging",
    status: "pending_shipment",
    notes: null,
    metadata: { deployment_id: "dep-mock-1" },
    created_at: "2026-04-06T00:00:00.000Z",
    updated_at: "2026-04-06T00:00:00.000Z",
  },
  {
    id: "mock-pipe-deploy",
    staff_id: "mock-sales-1",
    site_id: null,
    factory_name: "Western Mills",
    address: "Chakan MIDC",
    city: "Pune",
    state: "Maharashtra",
    postal_code: "410501",
    country: "IN",
    worker_count: 130,
    contact_name: "Meera",
    contact_phone: "+919911223344",
    lat: 18.7606,
    lng: 73.8632,
    planned_start: null,
    planned_end: null,
    device_count: 55,
    industry: "Textile",
    status: "pending_deployment",
    notes: null,
    metadata: {},
    created_at: "2026-04-07T00:00:00.000Z",
    updated_at: "2026-04-07T00:00:00.000Z",
  },
  {
    id: "mock-cs-accepted",
    staff_id: "mock-sales-1",
    site_id: null,
    factory_name: "Riverfront Apparel (awaiting CS visit)",
    address: "Howrah",
    city: "Kolkata",
    state: "West Bengal",
    postal_code: "711101",
    country: "IN",
    worker_count: 240,
    contact_name: "Arun",
    contact_phone: "+919933445566",
    lat: 22.5958,
    lng: 88.2636,
    planned_start: null,
    planned_end: null,
    device_count: null,
    industry: "Garment",
    status: "accepted",
    notes: null,
    metadata: {},
    created_at: "2026-04-09T09:00:00.000Z",
    updated_at: "2026-04-09T09:00:00.000Z",
  },
  {
    id: "mock-triage-new",
    staff_id: "mock-sales-1",
    site_id: null,
    factory_name: "Harbor Logistics",
    address: "Navi Mumbai",
    city: "Mumbai",
    state: "Maharashtra",
    postal_code: "400703",
    country: "IN",
    worker_count: 70,
    contact_name: "Vikram",
    contact_phone: "+919955667788",
    lat: 19.033,
    lng: 73.0297,
    planned_start: null,
    planned_end: null,
    device_count: null,
    industry: "Logistics",
    status: "lead",
    notes: null,
    metadata: {},
    created_at: "2026-04-09T08:00:00.000Z",
    updated_at: "2026-04-09T08:00:00.000Z",
  },
  {
    id: "mock-deployed-util",
    staff_id: MOCK_STAFF_ID,
    site_id: "site-live-1",
    factory_name: "Live Site Alpha",
    address: "Industrial Area Phase 2",
    city: "Bengaluru",
    state: "Karnataka",
    postal_code: "560100",
    country: "IN",
    worker_count: 88,
    contact_name: "Ops",
    contact_phone: "+919900000001",
    lat: 12.9352,
    lng: 77.6245,
    planned_start: "2026-04-01",
    planned_end: "2026-05-15",
    device_count: 44,
    industry: "Electronics",
    status: "deployed",
    notes: null,
    metadata: {},
    created_at: "2026-03-20T00:00:00.000Z",
    updated_at: "2026-04-01T00:00:00.000Z",
  },
];

function paginate<T>(items: T[]) {
  return { items, total: items.length, has_more: false };
}

function patchMockLead(id: string, patch: Partial<Lead>): Lead | undefined {
  const idx = mockLeads.findIndex((l) => l.id === id);
  if (idx < 0) return undefined;
  const prev = mockLeads[idx];
  const metaPatch = patch.metadata;
  const mergedMeta =
    metaPatch && typeof metaPatch === "object" && !Array.isArray(metaPatch)
      ? { ...prev.metadata, ...metaPatch }
      : patch.metadata !== undefined
        ? patch.metadata
        : prev.metadata;
  const { metadata: _m, ...rest } = patch;
  const next = {
    ...prev,
    ...rest,
    metadata: mergedMeta as Record<string, unknown>,
    updated_at: new Date().toISOString(),
  } as Lead;
  mockLeads = mockLeads.map((l, i) => (i === idx ? next : l));
  return next;
}

function cloneLeadAssignment(l: LeadAssignment): LeadAssignment {
  return {
    ...l,
    metadata: { ...l.metadata },
  };
}

function findLeadAssignment(id: string): LeadAssignment | undefined {
  return mockLeadAssignments.find((a) => a.id === id);
}

export interface MockResolveContext {
  path: string;
  method: string;
  /** Raw JSON body for POST/PATCH */
  body?: unknown;
  searchParams: URLSearchParams;
}

/**
 * Returns the payload shape the UI expects after `normalizeEnvelopePayload` (same as real API inner data).
 */
export function resolveMockOpsApi(ctx: MockResolveContext): unknown {
  const { path, method, body, searchParams } = ctx;
  const p = path.replace(/\/+$/, "") || "/";

  if (method === "GET" && p === "/ops/staff/me") {
    return mockStaffProfile;
  }

  if (method === "GET" && p === "/ops/leads/my-assignments") {
    const items = mockLeadAssignments.map(cloneLeadAssignment);
    if (searchParams.get("assignment_type")) {
      const t = searchParams.get("assignment_type")!;
      return {
        items: items.filter((a) => a.assignment_type === t),
        total: items.length,
        has_more: false,
      };
    }
    return { items, total: items.length, has_more: false };
  }

  if (method === "GET" && p === "/ops/staff-assignments") {
    return paginate(mockStaffAssignmentsFallback);
  }

  if (method === "GET" && p === "/ops/staff") {
    const role = searchParams.get("role");
    const items = role
      ? MOCK_STAFF_ROSTER.filter((s) => s.role === role)
      : MOCK_STAFF_ROSTER;
    return paginate(items);
  }

  if (method === "GET" && p === "/ops/locations") {
    const activeOnly = searchParams.get("active_only") === "true";
    const items = activeOnly
      ? MOCK_LOGISTICS_LOCATIONS.filter((l) => l.is_active)
      : MOCK_LOGISTICS_LOCATIONS;
    return paginate(items);
  }

  if (method === "GET" && p === "/ops/factories") {
    const ps = searchParams.get("pipeline_status");
    let items = [...MOCK_OPS_FACTORIES];
    if (ps) items = items.filter((f) => f.pipeline_status === ps);
    return paginate(items);
  }

  if (method === "GET" && p === "/ops/centres") {
    return paginate([...MOCK_OPS_CENTRES]);
  }

  const siteV2Summary = p.match(/^\/ops\/sites\/([^/]+)\/v2-summary$/);
  if (method === "GET" && siteV2Summary) {
    const id = siteV2Summary[1];
    const data = MOCK_SITE_V2_SUMMARY[id];
    if (!data) {
      throw new OpsMockHttpError("Site summary not found", 404);
    }
    return data;
  }

  const shipmentForDep = p.match(/^\/ops\/shipments\/for-deployment\/([^/]+)$/);
  if (method === "GET" && shipmentForDep) {
    const id = shipmentForDep[1];
    const data = MOCK_SHIPMENTS_BY_DEPLOYMENT[id];
    if (!data) {
      throw new OpsMockHttpError("Shipment not found for deployment", 404);
    }
    return data;
  }

  if (method === "GET" && p === "/ops/task-checklists") {
    return { items: Object.values(mockTaskChecklists) };
  }

  if (method === "GET" && p.startsWith("/ops/task-checklists/")) {
    const type = p.slice("/ops/task-checklists/".length) || "verifier";
    return mockTaskChecklists[type] ?? mockTaskChecklists.verifier;
  }

  const leadAssignmentsMatch = p.match(/^\/ops\/leads\/([^/]+)\/assignments$/);
  if (method === "GET" && leadAssignmentsMatch) {
    const leadId = leadAssignmentsMatch[1];
    const items = mockCrmAssignmentsByLeadId[leadId] ?? [];
    return paginate(items.map(cloneLeadAssignment));
  }

  if (method === "GET" && p === "/ops/leads") {
    return paginate(mockLeads);
  }

  if (method === "POST" && p === "/ops/staff/register") {
    const b = body as SelfRegisterStaffRequest;
    const res: SelfRegisterStaffResponse = {
      id: `mock-reg-${Date.now()}`,
      display_name: b.display_name,
      phone: b.phone ?? null,
      email: b.email ?? null,
      role: b.role === "sales" ? "ops_sales" : "ops_operator",
      status: "active",
    };
    return res;
  }

  // GET /ops/staff/claim-tokens/:token
  const claimMatch = p.match(/^\/ops\/staff\/claim-tokens\/([^/]+)$/);
  if (method === "GET" && claimMatch) {
    const r: StaffClaimResolveResponse = {
      valid: true,
      claim_status: "pending",
      display_name: "Invited Staff",
      phone: "+919000000000",
      role: "ops_operator",
      claimed_at: null,
    };
    return r;
  }

  const claimCompleteMatch = p.match(/^\/ops\/staff\/claim-tokens\/([^/]+)\/complete$/);
  if (method === "POST" && claimCompleteMatch) {
    const r: StaffClaimCompleteResponse = {
      claim_status: "claimed",
      claimed_at: new Date().toISOString(),
      role: "ops_operator",
    };
    return r;
  }

  const leadConfirm = p.match(/^\/ops\/leads\/([^/]+)\/confirm$/);
  if (method === "POST" && leadConfirm) {
    const id = leadConfirm[1];
    const lead = mockLeads.find((l) => l.id === id);
    if (lead) {
      const updated = { ...lead, status: "confirmed" as const, updated_at: new Date().toISOString() };
      mockLeads = mockLeads.map((l) => (l.id === id ? updated : l));
      return updated;
    }
  }

  const leadPatch = p.match(/^\/ops\/leads\/([^/]+)$/);
  if (method === "PATCH" && leadPatch) {
    const id = leadPatch[1];
    const patch = body as Record<string, unknown>;
    const lead = mockLeads.find((l) => l.id === id);
    if (lead) {
      const metaIn = patch.metadata;
      const mergedMeta =
        metaIn && typeof metaIn === "object" && !Array.isArray(metaIn)
          ? { ...lead.metadata, ...(metaIn as Record<string, unknown>) }
          : lead.metadata;
      const { metadata: _drop, ...restPatch } = patch;
      const updated = {
        ...lead,
        ...restPatch,
        metadata: mergedMeta,
        ...(typeof patch.status === "string" ? { status: patch.status } : {}),
        updated_at: new Date().toISOString(),
      } as Lead;
      mockLeads = mockLeads.map((l) => (l.id === id ? updated : l));
      return updated;
    }
  }

  if (method === "POST" && p === "/ops/leads") {
    const b = body as Record<string, unknown>;
    const newLead: Lead = {
      id: `mock-lead-${Date.now()}`,
      staff_id: String(b.staff_id ?? MOCK_STAFF_ID),
      site_id: null,
      factory_name: String(b.factory_name ?? "Factory"),
      address: (b.address as string) ?? null,
      city: (b.city as string) ?? null,
      state: (b.state as string) ?? null,
      postal_code: (b.postal_code as string) ?? null,
      country: "IN",
      worker_count: (b.worker_count as number) ?? null,
      contact_name: (b.contact_name as string) ?? null,
      contact_phone: (b.contact_phone as string) ?? null,
      lat: (b.lat as number) ?? null,
      lng: (b.lng as number) ?? null,
      planned_start: (b.planned_start as string) ?? null,
      planned_end: (b.planned_end as string) ?? null,
      device_count: (b.device_count as number) ?? null,
      status: "lead",
      notes: (b.notes as string) ?? null,
      metadata: (b.metadata as Record<string, unknown>) ?? {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockLeads = [...mockLeads, newLead];
    return newLead;
  }

  const lac = p.match(/^\/ops\/leads\/my-assignments\/([^/]+)\/confirm$/);
  if (method === "POST" && lac) {
    const id = lac[1];
    const found = findLeadAssignment(id);
    if (!found) throw new Error("Assignment not found");
    const updated = cloneLeadAssignment({ ...found, status: "confirmed", updated_at: new Date().toISOString() });
    mockLeadAssignments = mockLeadAssignments.map((a) => (a.id === id ? updated : a));
    return updated;
  }

  const lar = p.match(/^\/ops\/leads\/my-assignments\/([^/]+)\/reject$/);
  if (method === "POST" && lar) {
    const id = lar[1];
    const found = findLeadAssignment(id);
    if (!found) throw new Error("Assignment not found");
    const updated = cloneLeadAssignment({ ...found, status: "rejected", updated_at: new Date().toISOString() });
    mockLeadAssignments = mockLeadAssignments.map((a) => (a.id === id ? updated : a));
    return updated;
  }

  const sac = p.match(/^\/ops\/staff-assignments\/([^/]+)\/confirm$/);
  if (method === "POST" && sac) {
    const id = sac[1];
    const row = mockStaffAssignmentsFallback.find((a) => a.id === id);
    if (row) return { ...row, status: "confirmed" };
    return { ...mockStaffAssignmentsFallback[0], id, status: "confirmed" };
  }

  const sar = p.match(/^\/ops\/staff-assignments\/([^/]+)\/reject$/);
  if (method === "POST" && sar) {
    const id = sar[1];
    const row = mockStaffAssignmentsFallback.find((a) => a.id === id);
    if (row) return { ...row, status: "rejected" };
    return { ...mockStaffAssignmentsFallback[0], id, status: "rejected" };
  }

  const taskChecklistPut = p.match(/^\/ops\/task-checklists\/([^/]+)$/);
  if (method === "PUT" && taskChecklistPut) {
    const type = taskChecklistPut[1];
    const b = body as {
      title: string;
      items: { label: string; required: boolean }[];
      instructions?: string | null;
    };
    const prev = mockTaskChecklists[type] ?? mockTaskChecklists.verifier;
    const next: TaskChecklist = {
      ...prev,
      title: b.title,
      items: b.items,
      instructions: b.instructions ?? null,
      updated_at: new Date().toISOString(),
    };
    mockTaskChecklists[type] = next;
    return next;
  }

  const leadAccept = p.match(/^\/ops\/leads\/([^/]+)\/accept$/);
  if (method === "POST" && leadAccept) {
    const u = patchMockLead(leadAccept[1], { status: "accepted" });
    if (u) return u;
  }

  const leadReject = p.match(/^\/ops\/leads\/([^/]+)\/reject$/);
  if (method === "POST" && leadReject) {
    const u = patchMockLead(leadReject[1], { status: "rejected" });
    if (u) return u;
  }

  const assignVerifier = p.match(/^\/ops\/leads\/([^/]+)\/assign-verifier$/);
  if (method === "POST" && assignVerifier) {
    const leadId = assignVerifier[1];
    const b = body as { staff_id: string; scheduled_date?: string; notes?: string };
    const row: LeadAssignment = {
      id: `crm-v-${Date.now()}`,
      lead_id: leadId,
      staff_id: b.staff_id,
      assignment_type: "verifier",
      scheduled_date: b.scheduled_date ?? mockTodayIsoDate(),
      scheduled_time: null,
      status: "scheduled",
      notes: b.notes ?? null,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const rest = (mockCrmAssignmentsByLeadId[leadId] ?? []).filter(
      (a) => a.assignment_type !== "verifier",
    );
    mockCrmAssignmentsByLeadId[leadId] = [...rest, row];
    patchMockLead(leadId, { status: "pending_visit" });
    return row;
  }

  const leadVerify = p.match(/^\/ops\/leads\/([^/]+)\/verify$/);
  if (method === "POST" && leadVerify) {
    const u = patchMockLead(leadVerify[1], { status: "pending_allocation" });
    if (u) return u;
  }

  const leadAllocate = p.match(/^\/ops\/leads\/([^/]+)\/allocate$/);
  if (method === "POST" && leadAllocate) {
    const leadId = leadAllocate[1];
    const b = body as { device_count: number };
    const lead = mockLeads.find((l) => l.id === leadId);
    const u = patchMockLead(leadId, {
      status: "pending_shipment",
      device_count: b.device_count,
      metadata: {
        ...(lead?.metadata ?? {}),
        deployment_id: `dep-${leadId}`,
      },
    });
    if (u) return u;
  }

  const assignShipper = p.match(/^\/ops\/leads\/([^/]+)\/assign-shipper$/);
  if (method === "POST" && assignShipper) {
    const leadId = assignShipper[1];
    const b = body as { staff_id: string; scheduled_date?: string; notes?: string };
    const row: LeadAssignment = {
      id: `crm-s-${Date.now()}`,
      lead_id: leadId,
      staff_id: b.staff_id,
      assignment_type: "shipper",
      scheduled_date: b.scheduled_date ?? mockTomorrowIsoDate(),
      scheduled_time: null,
      status: "scheduled",
      notes: b.notes ?? null,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const rest = (mockCrmAssignmentsByLeadId[leadId] ?? []).filter(
      (a) => a.assignment_type !== "shipper",
    );
    mockCrmAssignmentsByLeadId[leadId] = [...rest, row];
    return row;
  }

  const leadDispatch = p.match(/^\/ops\/leads\/([^/]+)\/dispatch$/);
  if (method === "POST" && leadDispatch) {
    const u = patchMockLead(leadDispatch[1], { status: "pending_shipment" });
    if (u) return u;
  }

  const leadDeliver = p.match(/^\/ops\/leads\/([^/]+)\/deliver$/);
  if (method === "POST" && leadDeliver) {
    const id = leadDeliver[1];
    const lead = mockLeads.find((l) => l.id === id);
    if (lead) {
      const mergedMeta = {
        ...lead.metadata,
        field_ops_ready: false,
      };
      const u = patchMockLead(id, { status: "pending_deployment", metadata: mergedMeta });
      if (u) return u;
    }
  }

  const assignDeployer = p.match(/^\/ops\/leads\/([^/]+)\/assign-deployer$/);
  if (method === "POST" && assignDeployer) {
    const leadId = assignDeployer[1];
    const b = body as {
      staff_id: string;
      scheduled_date?: string;
      scheduled_time?: string;
      notes?: string;
    };
    const row: LeadAssignment = {
      id: `crm-d-${Date.now()}`,
      lead_id: leadId,
      staff_id: b.staff_id,
      assignment_type: "deployer",
      scheduled_date: b.scheduled_date ?? mockTodayIsoDate(),
      scheduled_time: b.scheduled_time ?? null,
      status: "scheduled",
      notes: b.notes ?? null,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const rest = (mockCrmAssignmentsByLeadId[leadId] ?? []).filter(
      (a) => a.assignment_type !== "deployer",
    );
    mockCrmAssignmentsByLeadId[leadId] = [...rest, row];
    return row;
  }

  const leadDeploy = p.match(/^\/ops\/leads\/([^/]+)\/deploy$/);
  if (method === "POST" && leadDeploy) {
    const id = leadDeploy[1];
    const lead = mockLeads.find((l) => l.id === id);
    if (!lead) {
      throw new OpsMockHttpError("Lead not found", 404);
    }
    const crew = lead.metadata.deployment_crew;
    const hasCrew =
      Array.isArray(crew) &&
      crew.some(
        (m) =>
          m &&
          typeof m === "object" &&
          String((m as { staff_id?: unknown }).staff_id ?? "").trim() !== "",
      );
    if (!hasCrew) {
      throw new OpsMockHttpError(
        "deployment_crew must include at least one staff_id",
        409,
      );
    }
    const u = patchMockLead(id, { status: "deployed" });
    if (u) return u;
    throw new OpsMockHttpError("Lead not found", 404);
  }

  throw new Error(`No mock for ${method} ${p}`);
}
