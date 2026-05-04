// Bloc 7C — PATCH transport_leg.

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

const FIELD_MAP: Record<string, string> = {
  title: "title",
  origin: "origin",
  destination: "destination",
  carrier: "carrier",
  mode: "mode",
  status: "status",
  cost: "cost",
  currency: "currency",
  eta: "eta",
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
    return Response.json({ error: "id transport invalide" }, { status: 400, headers: NO_STORE });
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

    if (k === "mode") {
      if (typeof v !== "string" || !TRANSPORT_MODES.includes(v as TransportMode))
        return Response.json(
          { error: `mode invalide (allowed: ${TRANSPORT_MODES.join(", ")})` },
          { status: 400, headers: NO_STORE }
        );
      pushSet(dbCol, v);
      continue;
    }
    if (k === "status") {
      if (typeof v !== "string" || !TRANSPORT_STATUSES.includes(v as TransportStatus))
        return Response.json(
          { error: `status invalide (allowed: ${TRANSPORT_STATUSES.join(", ")})` },
          { status: 400, headers: NO_STORE }
        );
      pushSet(dbCol, v);
      if (v === "completed") {
        sets.push(`completed_at = COALESCE(completed_at, now())`);
      }
      continue;
    }
    if (k === "cost") {
      if (v === null || v === "") {
        sets.push(`${dbCol} = NULL`);
        continue;
      }
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n) || n < 0)
        return Response.json({ error: "cost doit etre >= 0 ou null" }, { status: 400, headers: NO_STORE });
      pushSet(dbCol, n);
      continue;
    }
    if (k === "eta") {
      if (v === null || v === "") {
        sets.push(`${dbCol} = NULL`);
        continue;
      }
      if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v))
        return Response.json({ error: "eta doit etre YYYY-MM-DD ou null" }, { status: 400, headers: NO_STORE });
      pushSet(dbCol, v);
      continue;
    }
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
      { error: `aucun champ valide a mettre a jour (allowed: ${Object.keys(FIELD_MAP).join(", ")})` },
      { status: 400, headers: NO_STORE }
    );
  }
  sets.push(`updated_at = now()`);

  try {
    args.push(id);
    const updated = await adminQuery<Row>(
      `UPDATE core.transport_legs tl SET ${sets.join(", ")}
         WHERE tl.id = $${args.length}
       RETURNING tl.id, tl.tenant_id,
         (SELECT slug FROM core.tenant WHERE id = tl.tenant_id) AS tenant_slug,
         tl.delivery_id, tl.title, tl.origin, tl.destination, tl.carrier,
         tl.mode, tl.status, tl.cost, tl.currency,
         to_char(tl.eta, 'YYYY-MM-DD') AS eta,
         to_char(tl.completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS completed_at,
         tl.notes,
         to_char(tl.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
         to_char(tl.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at`,
      args
    );
    if (!updated[0]) {
      return Response.json({ error: "transport leg introuvable" }, { status: 404, headers: NO_STORE });
    }
    return Response.json({ item: mapRow(updated[0]) }, { headers: NO_STORE });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur DB" },
      { status: 502, headers: NO_STORE }
    );
  }
}
