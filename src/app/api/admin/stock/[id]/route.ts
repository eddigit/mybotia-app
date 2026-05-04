// Bloc 7C — PATCH stock item.
// Whitelist stricte. Validation enum + numérique. Pas de DELETE (status=archived).

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

const FIELD_MAP: Record<string, string> = {
  label: "label",
  sku: "sku",
  warehouse: "warehouse",
  location: "location",
  quantity: "quantity",
  minQuantity: "min_quantity",
  unit: "unit",
  status: "status",
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
    return Response.json({ error: "id stock invalide" }, { status: 400, headers: NO_STORE });
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

    if (k === "status") {
      if (typeof v !== "string" || !STOCK_STATUSES.includes(v as StockStatus))
        return Response.json(
          { error: `status invalide (allowed: ${STOCK_STATUSES.join(", ")})` },
          { status: 400, headers: NO_STORE }
        );
      pushSet(dbCol, v);
      continue;
    }
    if (k === "quantity" || k === "minQuantity") {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n) || n < 0)
        return Response.json(
          { error: `${k} doit etre >= 0` },
          { status: 400, headers: NO_STORE }
        );
      pushSet(dbCol, n);
      continue;
    }
    if (k === "label") {
      if (typeof v !== "string" || !v.trim())
        return Response.json({ error: "label doit etre une chaine non vide" }, { status: 400, headers: NO_STORE });
      pushSet(dbCol, v.trim());
      continue;
    }
    // Champs string nullable
    if (v === null) {
      sets.push(`${dbCol} = NULL`);
    } else {
      pushSet(dbCol, String(v));
    }
  }

  // updated_at toujours rafraîchi si changement
  if (sets.length === 0) {
    return Response.json(
      { error: `aucun champ valide a mettre a jour (allowed: ${Object.keys(FIELD_MAP).join(", ")})` },
      { status: 400, headers: NO_STORE }
    );
  }
  sets.push(`updated_at = now()`);

  try {
    args.push(id);
    const updated = await adminQuery<Row>(
      `UPDATE core.stock_items s SET ${sets.join(", ")}
         WHERE s.id = $${args.length}
       RETURNING s.id, s.tenant_id,
         (SELECT slug FROM core.tenant WHERE id = s.tenant_id) AS tenant_slug,
         s.catalog_item_id, s.label, s.sku, s.warehouse, s.location,
         s.quantity, s.min_quantity, s.unit, s.status,
         to_char(s.last_inventory_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_inventory_at,
         s.notes,
         to_char(s.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
         to_char(s.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at`,
      args
    );
    if (!updated[0]) {
      return Response.json({ error: "stock item introuvable" }, { status: 404, headers: NO_STORE });
    }
    return Response.json({ item: mapRow(updated[0]) }, { headers: NO_STORE });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur DB" },
      { status: 502, headers: NO_STORE }
    );
  }
}
