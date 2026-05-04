// Bloc 7D — VLM stock extra : GET liste + POST création.
// Verrou strict : tenant DOIT être 'vlmedical' (pas d'override 7D).

import { adminQuery } from "@/lib/admin-db";
import { requireSuperadmin } from "@/lib/admin-auth";
import { type VlmStockExtra } from "@/lib/vlm-types";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;
const VLM_SLUG = "vlmedical";

interface Row {
  id: string;
  tenant_id: string;
  tenant_slug: string;
  stock_item_id: string;
  lot_number: string | null;
  expiry_date: string | null;
  medical_category: string | null;
  conditioning: string | null;
  sterile: boolean | null;
  ce_marking: string | null;
  supplier_name: string | null;
  origin_country: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(r: Row): VlmStockExtra {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    tenantSlug: r.tenant_slug,
    stockItemId: r.stock_item_id,
    lotNumber: r.lot_number,
    expiryDate: r.expiry_date,
    medicalCategory: r.medical_category,
    conditioning: r.conditioning,
    sterile: r.sterile,
    ceMarking: r.ce_marking,
    supplierName: r.supplier_name,
    originCountry: r.origin_country,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const SELECT_COLS = `e.id, e.tenant_id, t.slug AS tenant_slug,
  e.stock_item_id, e.lot_number,
  to_char(e.expiry_date, 'YYYY-MM-DD') AS expiry_date,
  e.medical_category, e.conditioning, e.sterile, e.ce_marking,
  e.supplier_name, e.origin_country, e.notes,
  to_char(e.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
  to_char(e.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at`;

export async function GET(request: Request) {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get("tenant") || VLM_SLUG;
  if (tenantSlug !== VLM_SLUG) {
    return Response.json({ error: "VLM custom vertical réservé au tenant vlmedical" }, { status: 400, headers: NO_STORE });
  }
  try {
    const rows = await adminQuery<Row>(
      `SELECT ${SELECT_COLS}
         FROM core.vlm_stock_extra e
         JOIN core.tenant t ON t.id = e.tenant_id
        WHERE t.slug = $1
        ORDER BY e.expiry_date NULLS LAST, e.created_at DESC`,
      [tenantSlug]
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
  stockItemId: string;
  lotNumber?: string | null;
  expiryDate?: string | null;
  medicalCategory?: string | null;
  conditioning?: string | null;
  sterile?: boolean | null;
  ceMarking?: string | null;
  supplierName?: string | null;
  originCountry?: string | null;
  notes?: string | null;
}

function validateCreate(body: unknown): { ok: true; data: CreateBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "body invalide" };
  const b = body as Record<string, unknown>;
  if (typeof b.tenantSlug !== "string" || !b.tenantSlug)
    return { ok: false, error: "tenantSlug requis" };
  if (b.tenantSlug !== VLM_SLUG)
    return { ok: false, error: "VLM custom vertical réservé au tenant vlmedical" };
  if (typeof b.stockItemId !== "string" || !/^[0-9a-f-]{36}$/i.test(b.stockItemId))
    return { ok: false, error: "stockItemId requis (uuid)" };
  let expiryDate: string | null = null;
  if (typeof b.expiryDate === "string" && b.expiryDate.trim()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.expiryDate))
      return { ok: false, error: "expiryDate doit etre YYYY-MM-DD ou vide" };
    expiryDate = b.expiryDate;
  }
  return {
    ok: true,
    data: {
      tenantSlug: VLM_SLUG,
      stockItemId: b.stockItemId,
      lotNumber: typeof b.lotNumber === "string" && b.lotNumber.trim() ? b.lotNumber.trim() : null,
      expiryDate,
      medicalCategory: typeof b.medicalCategory === "string" && b.medicalCategory.trim() ? b.medicalCategory.trim() : null,
      conditioning: typeof b.conditioning === "string" && b.conditioning.trim() ? b.conditioning.trim() : null,
      sterile: typeof b.sterile === "boolean" ? b.sterile : null,
      ceMarking: typeof b.ceMarking === "string" && b.ceMarking.trim() ? b.ceMarking.trim() : null,
      supplierName: typeof b.supplierName === "string" && b.supplierName.trim() ? b.supplierName.trim() : null,
      originCountry: typeof b.originCountry === "string" && b.originCountry.trim() ? b.originCountry.trim() : null,
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
      [VLM_SLUG]
    );
    if (!tenantRows[0]) {
      return Response.json({ error: "tenant vlmedical introuvable" }, { status: 404, headers: NO_STORE });
    }
    const tenantId = tenantRows[0].id;

    // Vérifier que stock_item appartient bien à vlmedical
    const stockCheck = await adminQuery<{ id: string }>(
      "SELECT id FROM core.stock_items WHERE id = $1 AND tenant_id = $2",
      [d.stockItemId, tenantId]
    );
    if (!stockCheck[0]) {
      return Response.json(
        { error: "stockItemId inconnu ou hors tenant vlmedical" },
        { status: 400, headers: NO_STORE }
      );
    }

    const inserted = await adminQuery<{ r_id: string }>(
      `INSERT INTO core.vlm_stock_extra
         (tenant_id, stock_item_id, lot_number, expiry_date, medical_category,
          conditioning, sterile, ce_marking, supplier_name, origin_country, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id AS r_id`,
      [
        tenantId,
        d.stockItemId,
        d.lotNumber,
        d.expiryDate,
        d.medicalCategory,
        d.conditioning,
        d.sterile,
        d.ceMarking,
        d.supplierName,
        d.originCountry,
        d.notes,
      ]
    );
    const newId = inserted[0].r_id;
    const rows = await adminQuery<Row>(
      `SELECT ${SELECT_COLS}
         FROM core.vlm_stock_extra e
         JOIN core.tenant t ON t.id = e.tenant_id
        WHERE e.id = $1`,
      [newId]
    );
    return Response.json({ item: mapRow(rows[0]) }, { status: 201, headers: NO_STORE });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur DB";
    const status = /unique|duplicate/i.test(msg) ? 409 : 502;
    return Response.json({ error: msg }, { status, headers: NO_STORE });
  }
}
