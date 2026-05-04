// Bloc 7C — PATCH delivery.

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

const FIELD_MAP: Record<string, string> = {
  ref: "ref",
  clientName: "client_name",
  title: "title",
  shipFrom: "ship_from",
  shipTo: "ship_to",
  carrier: "carrier",
  status: "status",
  expectedDate: "expected_date",
  transportCost: "transport_cost",
  currency: "currency",
  trackingNumber: "tracking_number",
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
    return Response.json({ error: "id delivery invalide" }, { status: 400, headers: NO_STORE });
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
      if (typeof v !== "string" || !DELIVERY_STATUSES.includes(v as DeliveryStatus))
        return Response.json(
          { error: `status invalide (allowed: ${DELIVERY_STATUSES.join(", ")})` },
          { status: 400, headers: NO_STORE }
        );
      pushSet(dbCol, v);
      // Si delivered : on horodate delivered_at
      if (v === "delivered") {
        sets.push(`delivered_at = COALESCE(delivered_at, now())`);
      }
      continue;
    }
    if (k === "transportCost") {
      if (v === null || v === "") {
        sets.push(`${dbCol} = NULL`);
        continue;
      }
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n) || n < 0)
        return Response.json({ error: "transportCost doit etre >= 0 ou null" }, { status: 400, headers: NO_STORE });
      pushSet(dbCol, n);
      continue;
    }
    if (k === "expectedDate") {
      if (v === null || v === "") {
        sets.push(`${dbCol} = NULL`);
        continue;
      }
      if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v))
        return Response.json({ error: "expectedDate doit etre YYYY-MM-DD ou null" }, { status: 400, headers: NO_STORE });
      pushSet(dbCol, v);
      continue;
    }
    if (k === "title") {
      if (typeof v !== "string" || !v.trim())
        return Response.json({ error: "title doit etre une chaine non vide" }, { status: 400, headers: NO_STORE });
      pushSet(dbCol, v.trim());
      continue;
    }
    // String nullable
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
      `UPDATE core.deliveries d SET ${sets.join(", ")}
         WHERE d.id = $${args.length}
       RETURNING d.id, d.tenant_id,
         (SELECT slug FROM core.tenant WHERE id = d.tenant_id) AS tenant_slug,
         d.ref, d.client_name, d.title, d.ship_from, d.ship_to, d.carrier,
         d.status,
         to_char(d.expected_date, 'YYYY-MM-DD') AS expected_date,
         to_char(d.delivered_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS delivered_at,
         d.transport_cost, d.currency, d.tracking_number, d.notes,
         to_char(d.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
         to_char(d.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at`,
      args
    );
    if (!updated[0]) {
      return Response.json({ error: "delivery introuvable" }, { status: 404, headers: NO_STORE });
    }
    return Response.json({ item: mapRow(updated[0]) }, { headers: NO_STORE });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur DB";
    const status = /unique|duplicate/i.test(msg) ? 409 : 502;
    return Response.json({ error: msg }, { status, headers: NO_STORE });
  }
}
