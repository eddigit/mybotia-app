// Bloc 7B — PATCH catalog item.
// Whitelist stricte. Validation enum + numérique. Pas de DELETE (active=false).

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

const FIELD_MAP: Record<string, string> = {
  sku: "sku",
  name: "name",
  description: "description",
  category: "category",
  type: "type",
  unit: "unit",
  priceHt: "price_ht",
  vatRate: "vat_rate",
  currency: "currency",
  active: "active",
  visibleInQuotes: "visible_in_quotes",
  visibleToAi: "visible_to_ai",
  requiresAdminValidation: "requires_admin_validation",
  dolibarrProductId: "dolibarr_product_id",
  notes: "notes",
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  const { id } = await params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ error: "id catalog invalide" }, { status: 400, headers: NO_STORE });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "body json invalide" }, { status: 400, headers: NO_STORE });
  }

  const sets: string[] = [];
  const args: unknown[] = [];

  function pushSet(col: string, val: unknown) {
    args.push(val);
    sets.push(`${col} = $${args.length}`);
  }

  for (const [k, dbCol] of Object.entries(FIELD_MAP)) {
    if (!(k in body)) continue;
    const v = body[k];
    if (v === undefined) continue;

    if (k === "type") {
      if (typeof v !== "string" || !CATALOG_ITEM_TYPES.includes(v as CatalogItemType))
        return Response.json(
          { error: `type invalide (allowed: ${CATALOG_ITEM_TYPES.join(", ")})` },
          { status: 400, headers: NO_STORE }
        );
      pushSet(dbCol, v);
      continue;
    }
    if (k === "unit") {
      if (typeof v !== "string" || !CATALOG_ITEM_UNITS.includes(v as CatalogItemUnit))
        return Response.json(
          { error: `unit invalide (allowed: ${CATALOG_ITEM_UNITS.join(", ")})` },
          { status: 400, headers: NO_STORE }
        );
      pushSet(dbCol, v);
      continue;
    }
    if (k === "priceHt") {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n) || n < 0)
        return Response.json({ error: "priceHt doit etre >= 0" }, { status: 400, headers: NO_STORE });
      pushSet(dbCol, n);
      continue;
    }
    if (k === "vatRate") {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n) || n < 0)
        return Response.json({ error: "vatRate doit etre >= 0" }, { status: 400, headers: NO_STORE });
      pushSet(dbCol, n);
      continue;
    }
    if (k === "name") {
      if (typeof v !== "string" || !v.trim())
        return Response.json({ error: "name doit etre une chaine non vide" }, { status: 400, headers: NO_STORE });
      pushSet(dbCol, v.trim());
      continue;
    }
    if (
      k === "active" ||
      k === "visibleInQuotes" ||
      k === "visibleToAi" ||
      k === "requiresAdminValidation"
    ) {
      pushSet(dbCol, Boolean(v));
      continue;
    }
    // Champs string nullable
    if (v === null) {
      sets.push(`${dbCol} = NULL`);
    } else {
      pushSet(dbCol, String(v));
    }
  }

  if (sets.length === 0) {
    return Response.json(
      { error: `aucun champ valide a mettre a jour (allowed: ${Object.keys(FIELD_MAP).join(", ")})` },
      { status: 400, headers: NO_STORE }
    );
  }

  try {
    args.push(id);
    const updated = await adminQuery<Row>(
      `UPDATE core.catalog_items c SET ${sets.join(", ")}
         WHERE c.id = $${args.length}
       RETURNING c.id, c.tenant_id,
         (SELECT slug FROM core.tenant WHERE id = c.tenant_id) AS tenant_slug,
         c.sku, c.name, c.description, c.category, c.type, c.unit,
         c.price_ht, c.vat_rate, c.currency, c.active,
         c.visible_in_quotes, c.visible_to_ai, c.requires_admin_validation,
         c.dolibarr_product_id, c.notes,
         to_char(c.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
         to_char(c.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at`,
      args
    );
    if (!updated[0]) {
      return Response.json({ error: "item introuvable" }, { status: 404, headers: NO_STORE });
    }
    return Response.json({ item: mapRow(updated[0]) }, { headers: NO_STORE });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur DB";
    const status = /unique|duplicate/i.test(msg) ? 409 : 502;
    return Response.json({ error: msg }, { status, headers: NO_STORE });
  }
}
