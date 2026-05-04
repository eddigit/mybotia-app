// Bloc 7D — PATCH VLM container deal.

import { adminQuery } from "@/lib/admin-db";
import { requireSuperadmin } from "@/lib/admin-auth";
import {
  VLM_DEAL_STATUSES,
  type VlmContainerDeal,
  type VlmDealStatus,
} from "@/lib/vlm-types";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

interface Row {
  id: string;
  tenant_id: string;
  tenant_slug: string;
  delivery_id: string | null;
  ref: string | null;
  title: string;
  supplier_name: string | null;
  origin_country: string | null;
  destination_country: string | null;
  container_type: string | null;
  purchase_amount: string | null;
  transport_cost: string | null;
  customs_cost: string | null;
  insurance_cost: string | null;
  conditioning_cost: string | null;
  other_cost: string | null;
  sale_amount: string | null;
  currency: string;
  status: VlmDealStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function num(v: string | null): number | null {
  return v === null ? null : parseFloat(v);
}

function mapRow(r: Row): VlmContainerDeal {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    tenantSlug: r.tenant_slug,
    deliveryId: r.delivery_id,
    ref: r.ref,
    title: r.title,
    supplierName: r.supplier_name,
    originCountry: r.origin_country,
    destinationCountry: r.destination_country,
    containerType: r.container_type,
    purchaseAmount: num(r.purchase_amount),
    transportCost: num(r.transport_cost),
    customsCost: num(r.customs_cost),
    insuranceCost: num(r.insurance_cost),
    conditioningCost: num(r.conditioning_cost),
    otherCost: num(r.other_cost),
    saleAmount: num(r.sale_amount),
    currency: r.currency,
    status: r.status,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const NUMERIC_MAP: Record<string, string> = {
  purchaseAmount: "purchase_amount",
  transportCost: "transport_cost",
  customsCost: "customs_cost",
  insuranceCost: "insurance_cost",
  conditioningCost: "conditioning_cost",
  otherCost: "other_cost",
  saleAmount: "sale_amount",
};

const STRING_MAP: Record<string, string> = {
  ref: "ref",
  title: "title",
  supplierName: "supplier_name",
  originCountry: "origin_country",
  destinationCountry: "destination_country",
  containerType: "container_type",
  currency: "currency",
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

  // numeric amounts
  for (const [k, dbCol] of Object.entries(NUMERIC_MAP)) {
    if (!(k in body)) continue;
    const v = body[k];
    if (v === undefined) continue;
    if (v === null || v === "") {
      sets.push(`${dbCol} = NULL`);
      continue;
    }
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || n < 0)
      return Response.json({ error: `${k} doit etre >= 0 ou null` }, { status: 400, headers: NO_STORE });
    pushSet(dbCol, n);
  }

  // status
  if ("status" in body) {
    const v = body.status;
    if (typeof v !== "string" || !VLM_DEAL_STATUSES.includes(v as VlmDealStatus))
      return Response.json(
        { error: `status invalide (allowed: ${VLM_DEAL_STATUSES.join(", ")})` },
        { status: 400, headers: NO_STORE }
      );
    pushSet("status", v);
  }

  // string fields
  for (const [k, dbCol] of Object.entries(STRING_MAP)) {
    if (!(k in body)) continue;
    const v = body[k];
    if (v === undefined) continue;
    if (k === "title") {
      if (typeof v !== "string" || !v.trim())
        return Response.json({ error: "title doit etre une chaine non vide" }, { status: 400, headers: NO_STORE });
      pushSet(dbCol, v.trim());
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
      { error: `aucun champ valide a mettre a jour` },
      { status: 400, headers: NO_STORE }
    );
  }
  sets.push(`updated_at = now()`);

  try {
    args.push(id);
    const updated = await adminQuery<Row>(
      `UPDATE core.vlm_container_deals cd SET ${sets.join(", ")}
         WHERE cd.id = $${args.length}
       RETURNING cd.id, cd.tenant_id,
         (SELECT slug FROM core.tenant WHERE id = cd.tenant_id) AS tenant_slug,
         cd.delivery_id, cd.ref, cd.title,
         cd.supplier_name, cd.origin_country, cd.destination_country, cd.container_type,
         cd.purchase_amount, cd.transport_cost, cd.customs_cost, cd.insurance_cost,
         cd.conditioning_cost, cd.other_cost, cd.sale_amount,
         cd.currency, cd.status, cd.notes,
         to_char(cd.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
         to_char(cd.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at`,
      args
    );
    if (!updated[0]) {
      return Response.json({ error: "VLM container deal introuvable" }, { status: 404, headers: NO_STORE });
    }
    return Response.json({ item: mapRow(updated[0]) }, { headers: NO_STORE });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur DB";
    const status = /unique|duplicate/i.test(msg) ? 409 : 502;
    return Response.json({ error: msg }, { status, headers: NO_STORE });
  }
}
