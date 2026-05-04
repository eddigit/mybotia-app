// Bloc 7D — PATCH VLM stock extra.

import { adminQuery } from "@/lib/admin-db";
import { requireSuperadmin } from "@/lib/admin-auth";
import { type VlmStockExtra } from "@/lib/vlm-types";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

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

const FIELD_MAP: Record<string, string> = {
  lotNumber: "lot_number",
  expiryDate: "expiry_date",
  medicalCategory: "medical_category",
  conditioning: "conditioning",
  sterile: "sterile",
  ceMarking: "ce_marking",
  supplierName: "supplier_name",
  originCountry: "origin_country",
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
    return Response.json({ error: "id invalide" }, { status: 400, headers: NO_STORE });
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

    if (k === "expiryDate") {
      if (v === null || v === "") {
        sets.push(`${dbCol} = NULL`);
        continue;
      }
      if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v))
        return Response.json({ error: "expiryDate doit etre YYYY-MM-DD ou null" }, { status: 400, headers: NO_STORE });
      pushSet(dbCol, v);
      continue;
    }
    if (k === "sterile") {
      if (v === null) {
        sets.push(`${dbCol} = NULL`);
      } else {
        pushSet(dbCol, Boolean(v));
      }
      continue;
    }
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
  sets.push(`updated_at = now()`);

  try {
    args.push(id);
    const updated = await adminQuery<Row>(
      `UPDATE core.vlm_stock_extra e SET ${sets.join(", ")}
         WHERE e.id = $${args.length}
       RETURNING e.id, e.tenant_id,
         (SELECT slug FROM core.tenant WHERE id = e.tenant_id) AS tenant_slug,
         e.stock_item_id, e.lot_number,
         to_char(e.expiry_date, 'YYYY-MM-DD') AS expiry_date,
         e.medical_category, e.conditioning, e.sterile, e.ce_marking,
         e.supplier_name, e.origin_country, e.notes,
         to_char(e.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
         to_char(e.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at`,
      args
    );
    if (!updated[0]) {
      return Response.json({ error: "VLM stock extra introuvable" }, { status: 404, headers: NO_STORE });
    }
    return Response.json({ item: mapRow(updated[0]) }, { headers: NO_STORE });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur DB" },
      { status: 502, headers: NO_STORE }
    );
  }
}
