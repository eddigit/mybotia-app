// Bloc 7C — API admin deliveries (livraisons / expéditions génériques).
//   GET  /api/admin/deliveries?tenant=<slug>  → liste
//   POST /api/admin/deliveries                → création
// ACL : superadmin uniquement.

import { adminQuery } from "@/lib/admin-db";
import { requireSuperadmin } from "@/lib/admin-auth";
import {
  DELIVERY_STATUSES,
  type Delivery,
  type DeliveryStatus,
} from "@/lib/delivery-types";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

interface Row {
  id: string;
  tenant_id: string;
  tenant_slug: string;
  ref: string | null;
  client_name: string | null;
  title: string;
  ship_from: string | null;
  ship_to: string | null;
  carrier: string | null;
  status: DeliveryStatus;
  expected_date: string | null;
  delivered_at: string | null;
  transport_cost: string | null;
  currency: string;
  tracking_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(r: Row): Delivery {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    tenantSlug: r.tenant_slug,
    ref: r.ref,
    clientName: r.client_name,
    title: r.title,
    shipFrom: r.ship_from,
    shipTo: r.ship_to,
    carrier: r.carrier,
    status: r.status,
    expectedDate: r.expected_date,
    deliveredAt: r.delivered_at,
    transportCost: r.transport_cost !== null ? parseFloat(r.transport_cost) : null,
    currency: r.currency,
    trackingNumber: r.tracking_number,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const SELECT_COLS = `d.id, d.tenant_id, t.slug AS tenant_slug,
  d.ref, d.client_name, d.title, d.ship_from, d.ship_to, d.carrier,
  d.status,
  to_char(d.expected_date, 'YYYY-MM-DD') AS expected_date,
  to_char(d.delivered_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS delivered_at,
  d.transport_cost, d.currency, d.tracking_number, d.notes,
  to_char(d.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
  to_char(d.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at`;

export async function GET(request: Request) {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get("tenant");
  const params: unknown[] = [];
  let where = "";
  if (tenantSlug) {
    params.push(tenantSlug);
    where = "WHERE t.slug = $1";
  }
  try {
    const rows = await adminQuery<Row>(
      `SELECT ${SELECT_COLS}
         FROM core.deliveries d
         JOIN core.tenant t ON t.id = d.tenant_id
        ${where}
        ORDER BY d.expected_date NULLS LAST, d.created_at DESC`,
      params
    );
    return Response.json({ items: rows.map(mapRow) }, { headers: NO_STORE });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur DB" },
      { status: 502, headers: NO_STORE }
    );
  }
}

interface CreateBody {
  tenantSlug: string;
  ref?: string | null;
  clientName?: string | null;
  title: string;
  shipFrom?: string | null;
  shipTo?: string | null;
  carrier?: string | null;
  status?: DeliveryStatus;
  expectedDate?: string | null;
  transportCost?: number | null;
  currency?: string;
  trackingNumber?: string | null;
  notes?: string | null;
}

function validateCreate(body: unknown): { ok: true; data: CreateBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "body invalide" };
  const b = body as Record<string, unknown>;
  if (typeof b.tenantSlug !== "string" || !b.tenantSlug)
    return { ok: false, error: "tenantSlug requis" };
  if (typeof b.title !== "string" || !b.title.trim())
    return { ok: false, error: "title requis" };
  const status = typeof b.status === "string" ? b.status : "pending";
  if (!DELIVERY_STATUSES.includes(status as DeliveryStatus))
    return { ok: false, error: `status invalide (allowed: ${DELIVERY_STATUSES.join(", ")})` };
  let transportCost: number | null = null;
  if (b.transportCost !== undefined && b.transportCost !== null && b.transportCost !== "") {
    const n = Number(b.transportCost);
    if (!Number.isFinite(n) || n < 0)
      return { ok: false, error: "transportCost doit etre >= 0 ou null" };
    transportCost = n;
  }
  let expectedDate: string | null = null;
  if (typeof b.expectedDate === "string" && b.expectedDate.trim()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.expectedDate))
      return { ok: false, error: "expectedDate doit etre YYYY-MM-DD ou vide" };
    expectedDate = b.expectedDate;
  }
  return {
    ok: true,
    data: {
      tenantSlug: b.tenantSlug,
      ref: typeof b.ref === "string" && b.ref.trim() ? b.ref.trim() : null,
      clientName: typeof b.clientName === "string" && b.clientName.trim() ? b.clientName.trim() : null,
      title: b.title.trim(),
      shipFrom: typeof b.shipFrom === "string" && b.shipFrom.trim() ? b.shipFrom.trim() : null,
      shipTo: typeof b.shipTo === "string" && b.shipTo.trim() ? b.shipTo.trim() : null,
      carrier: typeof b.carrier === "string" && b.carrier.trim() ? b.carrier.trim() : null,
      status: status as DeliveryStatus,
      expectedDate,
      transportCost,
      currency: typeof b.currency === "string" && b.currency ? b.currency : "EUR",
      trackingNumber: typeof b.trackingNumber === "string" && b.trackingNumber.trim() ? b.trackingNumber.trim() : null,
      notes: typeof b.notes === "string" ? b.notes : null,
    },
  };
}

export async function POST(request: Request) {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body json invalide" }, { status: 400, headers: NO_STORE });
  }
  const v = validateCreate(body);
  if (!v.ok) return Response.json({ error: v.error }, { status: 400, headers: NO_STORE });
  const d = v.data;

  try {
    const tenantRows = await adminQuery<{ id: string }>(
      "SELECT id FROM core.tenant WHERE slug = $1",
      [d.tenantSlug]
    );
    if (!tenantRows[0]) {
      return Response.json({ error: "tenant inconnu" }, { status: 404, headers: NO_STORE });
    }
    const tenantId = tenantRows[0].id;

    const inserted = await adminQuery<{ r_id: string }>(
      `INSERT INTO core.deliveries
         (tenant_id, ref, client_name, title, ship_from, ship_to, carrier, status,
          expected_date, transport_cost, currency, tracking_number, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id AS r_id`,
      [
        tenantId,
        d.ref,
        d.clientName,
        d.title,
        d.shipFrom,
        d.shipTo,
        d.carrier,
        d.status,
        d.expectedDate,
        d.transportCost,
        d.currency,
        d.trackingNumber,
        d.notes,
      ]
    );
    const newId = inserted[0].r_id;
    const rows = await adminQuery<Row>(
      `SELECT ${SELECT_COLS}
         FROM core.deliveries d
         JOIN core.tenant t ON t.id = d.tenant_id
        WHERE d.id = $1`,
      [newId]
    );
    return Response.json({ item: mapRow(rows[0]) }, { status: 201, headers: NO_STORE });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur DB";
    const status = /unique|duplicate/i.test(msg) ? 409 : 502;
    return Response.json({ error: msg }, { status, headers: NO_STORE });
  }
}
