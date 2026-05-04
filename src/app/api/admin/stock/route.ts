// Bloc 7C — API admin stock items.
//   GET  /api/admin/stock?tenant=<slug>  → liste
//   POST /api/admin/stock                → création
// ACL : superadmin uniquement.

import { adminQuery } from "@/lib/admin-db";
import { requireSuperadmin } from "@/lib/admin-auth";
import {
  STOCK_STATUSES,
  type StockItem,
  type StockStatus,
} from "@/lib/stock-types";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

interface Row {
  id: string;
  tenant_id: string;
  tenant_slug: string;
  catalog_item_id: string | null;
  label: string;
  sku: string | null;
  warehouse: string | null;
  location: string | null;
  quantity: string;
  min_quantity: string;
  unit: string | null;
  status: StockStatus;
  last_inventory_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(r: Row): StockItem {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    tenantSlug: r.tenant_slug,
    catalogItemId: r.catalog_item_id,
    label: r.label,
    sku: r.sku,
    warehouse: r.warehouse,
    location: r.location,
    quantity: parseFloat(r.quantity) || 0,
    minQuantity: parseFloat(r.min_quantity) || 0,
    unit: r.unit,
    status: r.status,
    lastInventoryAt: r.last_inventory_at,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const SELECT_COLS = `s.id, s.tenant_id, t.slug AS tenant_slug,
  s.catalog_item_id, s.label, s.sku, s.warehouse, s.location,
  s.quantity, s.min_quantity, s.unit, s.status,
  to_char(s.last_inventory_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_inventory_at,
  s.notes,
  to_char(s.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
  to_char(s.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at`;

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
         FROM core.stock_items s
         JOIN core.tenant t ON t.id = s.tenant_id
        ${where}
        ORDER BY s.status, s.warehouse NULLS LAST, s.label`,
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
  catalogItemId?: string | null;
  label: string;
  sku?: string | null;
  warehouse?: string | null;
  location?: string | null;
  quantity?: number;
  minQuantity?: number;
  unit?: string | null;
  status?: StockStatus;
  notes?: string | null;
}

function validateCreate(body: unknown): { ok: true; data: CreateBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "body invalide" };
  const b = body as Record<string, unknown>;
  if (typeof b.tenantSlug !== "string" || !b.tenantSlug)
    return { ok: false, error: "tenantSlug requis" };
  if (typeof b.label !== "string" || !b.label.trim())
    return { ok: false, error: "label requis" };
  const status = typeof b.status === "string" ? b.status : "active";
  if (!STOCK_STATUSES.includes(status as StockStatus))
    return { ok: false, error: `status invalide (allowed: ${STOCK_STATUSES.join(", ")})` };
  const quantity = b.quantity !== undefined ? Number(b.quantity) : 0;
  if (!Number.isFinite(quantity) || quantity < 0)
    return { ok: false, error: "quantity doit etre un nombre >= 0" };
  const minQuantity = b.minQuantity !== undefined ? Number(b.minQuantity) : 0;
  if (!Number.isFinite(minQuantity) || minQuantity < 0)
    return { ok: false, error: "minQuantity doit etre un nombre >= 0" };
  const catalogItemId =
    typeof b.catalogItemId === "string" && /^[0-9a-f-]{36}$/i.test(b.catalogItemId)
      ? b.catalogItemId
      : null;
  return {
    ok: true,
    data: {
      tenantSlug: b.tenantSlug,
      catalogItemId,
      label: b.label.trim(),
      sku: typeof b.sku === "string" && b.sku.trim() ? b.sku.trim() : null,
      warehouse: typeof b.warehouse === "string" && b.warehouse.trim() ? b.warehouse.trim() : null,
      location: typeof b.location === "string" && b.location.trim() ? b.location.trim() : null,
      quantity,
      minQuantity,
      unit: typeof b.unit === "string" && b.unit.trim() ? b.unit.trim() : null,
      status: status as StockStatus,
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

    if (d.catalogItemId) {
      const catCheck = await adminQuery<{ id: string }>(
        "SELECT id FROM core.catalog_items WHERE id = $1 AND tenant_id = $2",
        [d.catalogItemId, tenantId]
      );
      if (!catCheck[0]) {
        return Response.json(
          { error: "catalogItemId inconnu ou hors tenant" },
          { status: 400, headers: NO_STORE }
        );
      }
    }

    const inserted = await adminQuery<Row>(
      `INSERT INTO core.stock_items
         (tenant_id, catalog_item_id, label, sku, warehouse, location,
          quantity, min_quantity, unit, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id AS r_id`,
      [
        tenantId,
        d.catalogItemId,
        d.label,
        d.sku,
        d.warehouse,
        d.location,
        d.quantity,
        d.minQuantity,
        d.unit,
        d.status,
        d.notes,
      ]
    );
    const newId = (inserted[0] as unknown as { r_id: string }).r_id;
    const rows = await adminQuery<Row>(
      `SELECT ${SELECT_COLS}
         FROM core.stock_items s
         JOIN core.tenant t ON t.id = s.tenant_id
        WHERE s.id = $1`,
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
