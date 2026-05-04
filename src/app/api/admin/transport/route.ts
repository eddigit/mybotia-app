// Bloc 7C — API admin transport_legs (étapes de transport).
//   GET  /api/admin/transport?tenant=<slug>  → liste
//   POST /api/admin/transport                → création
// ACL : superadmin uniquement.

import { adminQuery } from "@/lib/admin-db";
import { requireSuperadmin } from "@/lib/admin-auth";
import {
  TRANSPORT_MODES,
  TRANSPORT_STATUSES,
  type TransportLeg,
  type TransportMode,
  type TransportStatus,
} from "@/lib/transport-types";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

interface Row {
  id: string;
  tenant_id: string;
  tenant_slug: string;
  delivery_id: string | null;
  title: string;
  origin: string | null;
  destination: string | null;
  carrier: string | null;
  mode: TransportMode;
  status: TransportStatus;
  cost: string | null;
  currency: string;
  eta: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(r: Row): TransportLeg {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    tenantSlug: r.tenant_slug,
    deliveryId: r.delivery_id,
    title: r.title,
    origin: r.origin,
    destination: r.destination,
    carrier: r.carrier,
    mode: r.mode,
    status: r.status,
    cost: r.cost !== null ? parseFloat(r.cost) : null,
    currency: r.currency,
    eta: r.eta,
    completedAt: r.completed_at,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const SELECT_COLS = `tl.id, tl.tenant_id, t.slug AS tenant_slug,
  tl.delivery_id, tl.title, tl.origin, tl.destination, tl.carrier,
  tl.mode, tl.status, tl.cost, tl.currency,
  to_char(tl.eta, 'YYYY-MM-DD') AS eta,
  to_char(tl.completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS completed_at,
  tl.notes,
  to_char(tl.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
  to_char(tl.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at`;

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
         FROM core.transport_legs tl
         JOIN core.tenant t ON t.id = tl.tenant_id
        ${where}
        ORDER BY tl.eta NULLS LAST, tl.created_at DESC`,
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
  deliveryId?: string | null;
  title: string;
  origin?: string | null;
  destination?: string | null;
  carrier?: string | null;
  mode?: TransportMode;
  status?: TransportStatus;
  cost?: number | null;
  currency?: string;
  eta?: string | null;
  notes?: string | null;
}

function validateCreate(body: unknown): { ok: true; data: CreateBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "body invalide" };
  const b = body as Record<string, unknown>;
  if (typeof b.tenantSlug !== "string" || !b.tenantSlug)
    return { ok: false, error: "tenantSlug requis" };
  if (typeof b.title !== "string" || !b.title.trim())
    return { ok: false, error: "title requis" };
  const mode = typeof b.mode === "string" ? b.mode : "road";
  if (!TRANSPORT_MODES.includes(mode as TransportMode))
    return { ok: false, error: `mode invalide (allowed: ${TRANSPORT_MODES.join(", ")})` };
  const status = typeof b.status === "string" ? b.status : "planned";
  if (!TRANSPORT_STATUSES.includes(status as TransportStatus))
    return { ok: false, error: `status invalide (allowed: ${TRANSPORT_STATUSES.join(", ")})` };
  let cost: number | null = null;
  if (b.cost !== undefined && b.cost !== null && b.cost !== "") {
    const n = Number(b.cost);
    if (!Number.isFinite(n) || n < 0)
      return { ok: false, error: "cost doit etre >= 0 ou null" };
    cost = n;
  }
  let eta: string | null = null;
  if (typeof b.eta === "string" && b.eta.trim()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.eta))
      return { ok: false, error: "eta doit etre YYYY-MM-DD ou vide" };
    eta = b.eta;
  }
  const deliveryId =
    typeof b.deliveryId === "string" && /^[0-9a-f-]{36}$/i.test(b.deliveryId)
      ? b.deliveryId
      : null;
  return {
    ok: true,
    data: {
      tenantSlug: b.tenantSlug,
      deliveryId,
      title: b.title.trim(),
      origin: typeof b.origin === "string" && b.origin.trim() ? b.origin.trim() : null,
      destination: typeof b.destination === "string" && b.destination.trim() ? b.destination.trim() : null,
      carrier: typeof b.carrier === "string" && b.carrier.trim() ? b.carrier.trim() : null,
      mode: mode as TransportMode,
      status: status as TransportStatus,
      cost,
      currency: typeof b.currency === "string" && b.currency ? b.currency : "EUR",
      eta,
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

    if (d.deliveryId) {
      const dlvCheck = await adminQuery<{ id: string }>(
        "SELECT id FROM core.deliveries WHERE id = $1 AND tenant_id = $2",
        [d.deliveryId, tenantId]
      );
      if (!dlvCheck[0]) {
        return Response.json(
          { error: "deliveryId inconnu ou hors tenant" },
          { status: 400, headers: NO_STORE }
        );
      }
    }

    const inserted = await adminQuery<{ r_id: string }>(
      `INSERT INTO core.transport_legs
         (tenant_id, delivery_id, title, origin, destination, carrier,
          mode, status, cost, currency, eta, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id AS r_id`,
      [
        tenantId,
        d.deliveryId,
        d.title,
        d.origin,
        d.destination,
        d.carrier,
        d.mode,
        d.status,
        d.cost,
        d.currency,
        d.eta,
        d.notes,
      ]
    );
    const newId = inserted[0].r_id;
    const rows = await adminQuery<Row>(
      `SELECT ${SELECT_COLS}
         FROM core.transport_legs tl
         JOIN core.tenant t ON t.id = tl.tenant_id
        WHERE tl.id = $1`,
      [newId]
    );
    return Response.json({ item: mapRow(rows[0]) }, { status: 201, headers: NO_STORE });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur DB" },
      { status: 502, headers: NO_STORE }
    );
  }
}
