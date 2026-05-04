// Bloc 7B — API admin catalogue produits/services.
//   GET /api/admin/catalog?tenant=<slug>  → liste
//   POST /api/admin/catalog                → création
// ACL : superadmin uniquement.

import { adminQuery } from "@/lib/admin-db";
import { requireSuperadmin } from "@/lib/admin-auth";
import {
  CATALOG_ITEM_TYPES,
  CATALOG_ITEM_UNITS,
  type CatalogItem,
  type CatalogItemType,
  type CatalogItemUnit,
} from "@/lib/catalog-types";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

interface Row {
  id: string;
  tenant_id: string;
  tenant_slug: string;
  sku: string | null;
  name: string;
  description: string | null;
  category: string | null;
  type: CatalogItemType;
  unit: CatalogItemUnit;
  price_ht: string;
  vat_rate: string;
  currency: string;
  active: boolean;
  visible_in_quotes: boolean;
  visible_to_ai: boolean;
  requires_admin_validation: boolean;
  dolibarr_product_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(r: Row): CatalogItem {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    tenantSlug: r.tenant_slug,
    sku: r.sku,
    name: r.name,
    description: r.description,
    category: r.category,
    type: r.type,
    unit: r.unit,
    priceHt: parseFloat(r.price_ht) || 0,
    vatRate: parseFloat(r.vat_rate) || 0,
    currency: r.currency,
    active: r.active,
    visibleInQuotes: r.visible_in_quotes,
    visibleToAi: r.visible_to_ai,
    requiresAdminValidation: r.requires_admin_validation,
    dolibarrProductId: r.dolibarr_product_id,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

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
      `SELECT c.id, c.tenant_id, t.slug AS tenant_slug,
              c.sku, c.name, c.description, c.category, c.type, c.unit,
              c.price_ht, c.vat_rate, c.currency, c.active,
              c.visible_in_quotes, c.visible_to_ai, c.requires_admin_validation,
              c.dolibarr_product_id, c.notes,
              to_char(c.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
              to_char(c.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
         FROM core.catalog_items c
         JOIN core.tenant t ON t.id = c.tenant_id
        ${where}
        ORDER BY c.active DESC, c.type, c.name`,
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
  sku?: string | null;
  name: string;
  description?: string | null;
  category?: string | null;
  type: CatalogItemType;
  unit: CatalogItemUnit;
  priceHt?: number;
  vatRate?: number;
  currency?: string;
  active?: boolean;
  visibleInQuotes?: boolean;
  visibleToAi?: boolean;
  requiresAdminValidation?: boolean;
  dolibarrProductId?: string | null;
  notes?: string | null;
}

function validateCreate(body: unknown): { ok: true; data: CreateBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "body invalide" };
  const b = body as Record<string, unknown>;
  if (typeof b.tenantSlug !== "string" || !b.tenantSlug)
    return { ok: false, error: "tenantSlug requis" };
  if (typeof b.name !== "string" || !b.name.trim())
    return { ok: false, error: "name requis" };
  if (typeof b.type !== "string" || !CATALOG_ITEM_TYPES.includes(b.type as CatalogItemType))
    return { ok: false, error: `type invalide (allowed: ${CATALOG_ITEM_TYPES.join(", ")})` };
  if (typeof b.unit !== "string" || !CATALOG_ITEM_UNITS.includes(b.unit as CatalogItemUnit))
    return { ok: false, error: `unit invalide (allowed: ${CATALOG_ITEM_UNITS.join(", ")})` };
  const priceHt = b.priceHt !== undefined ? Number(b.priceHt) : 0;
  if (!Number.isFinite(priceHt) || priceHt < 0)
    return { ok: false, error: "priceHt doit etre un nombre >= 0" };
  const vatRate = b.vatRate !== undefined ? Number(b.vatRate) : 20;
  if (!Number.isFinite(vatRate) || vatRate < 0)
    return { ok: false, error: "vatRate doit etre un nombre >= 0" };
  return {
    ok: true,
    data: {
      tenantSlug: b.tenantSlug,
      sku: typeof b.sku === "string" && b.sku.trim() ? b.sku.trim() : null,
      name: b.name.trim(),
      description: typeof b.description === "string" ? b.description : null,
      category: typeof b.category === "string" ? b.category : null,
      type: b.type as CatalogItemType,
      unit: b.unit as CatalogItemUnit,
      priceHt,
      vatRate,
      currency: typeof b.currency === "string" && b.currency ? b.currency : "EUR",
      active: b.active === undefined ? true : Boolean(b.active),
      visibleInQuotes: b.visibleInQuotes === undefined ? true : Boolean(b.visibleInQuotes),
      visibleToAi: b.visibleToAi === undefined ? true : Boolean(b.visibleToAi),
      requiresAdminValidation:
        b.requiresAdminValidation === undefined ? false : Boolean(b.requiresAdminValidation),
      dolibarrProductId: typeof b.dolibarrProductId === "string" ? b.dolibarrProductId : null,
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

    const inserted = await adminQuery<Row>(
      `INSERT INTO core.catalog_items
       (tenant_id, sku, name, description, category, type, unit,
        price_ht, vat_rate, currency, active,
        visible_in_quotes, visible_to_ai, requires_admin_validation,
        dolibarr_product_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING id, tenant_id,
         (SELECT slug FROM core.tenant WHERE id = $1) AS tenant_slug,
         sku, name, description, category, type, unit,
         price_ht, vat_rate, currency, active,
         visible_in_quotes, visible_to_ai, requires_admin_validation,
         dolibarr_product_id, notes,
         to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
         to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at`,
      [
        tenantId,
        d.sku,
        d.name,
        d.description,
        d.category,
        d.type,
        d.unit,
        d.priceHt,
        d.vatRate,
        d.currency,
        d.active,
        d.visibleInQuotes,
        d.visibleToAi,
        d.requiresAdminValidation,
        d.dolibarrProductId,
        d.notes,
      ]
    );
    return Response.json({ item: mapRow(inserted[0]) }, { status: 201, headers: NO_STORE });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur DB";
    // Détecter violation contrainte unique SKU
    const status = /unique|duplicate/i.test(msg) ? 409 : 502;
    return Response.json({ error: msg }, { status, headers: NO_STORE });
  }
}
