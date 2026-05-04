// Bloc 7H — GET détail + PATCH devis VLM.

import { adminQuery } from "@/lib/admin-db";
import { requireVlmAccess } from "@/lib/vlm-access";
import { getVlmQuote, getVlmQuoteRow } from "@/lib/vlm-quote-data";
import { VLM_QUOTE_STATUSES, type VlmQuoteStatus } from "@/lib/vlm-quote-types";
import {
  isAllowedTransition,
  isQuoteEditable,
  logVlmQuoteEvent,
} from "@/lib/vlm-quote-events";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireVlmAccess();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  const { id } = await params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ error: "id invalide" }, { status: 400, headers: NO_STORE });
  }
  try {
    const quote = await getVlmQuote(id);
    if (!quote) {
      return Response.json({ error: "devis introuvable" }, { status: 404, headers: NO_STORE });
    }
    return Response.json({ item: quote }, { headers: NO_STORE });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur DB" },
      { status: 502, headers: NO_STORE }
    );
  }
}

const FIELD_MAP: Record<string, string> = {
  clientName: "client_name",
  clientEmail: "client_email",
  clientAddress: "client_address",
  title: "title",
  status: "status",
  currency: "currency",
  validUntil: "valid_until",
  notes: "notes",
  terms: "terms",
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireVlmAccess();
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

  // Vérifier que le devis existe et est dans le tenant
  const existing = await getVlmQuoteRow(id);
  if (!existing) {
    return Response.json({ error: "devis introuvable" }, { status: 404, headers: NO_STORE });
  }

  // Bloc 7J — verrouillage workflow
  const currentStatus = existing.status as VlmQuoteStatus;
  const requestedStatus =
    "status" in body && typeof body.status === "string"
      ? (body.status as VlmQuoteStatus)
      : null;

  // Si status demandé : valider la transition
  if (requestedStatus !== null) {
    if (!VLM_QUOTE_STATUSES.includes(requestedStatus)) {
      return Response.json(
        { error: `status invalide (allowed: ${VLM_QUOTE_STATUSES.join(", ")})` },
        { status: 400, headers: NO_STORE }
      );
    }
    if (!isAllowedTransition(currentStatus, requestedStatus)) {
      return Response.json(
        {
          error: `transition de statut interdite : ${currentStatus} → ${requestedStatus}`,
        },
        { status: 409, headers: NO_STORE }
      );
    }
  }

  // Si on tente de modifier d'autres champs que status alors que !draft : refus
  const nonStatusKeysInBody = Object.keys(body).filter(
    (k) => k !== "status" && k in FIELD_MAP
  );
  if (nonStatusKeysInBody.length > 0 && !isQuoteEditable(currentStatus)) {
    return Response.json(
      {
        error: `devis verrouillé (status=${currentStatus}) — seules les transitions de statut sont autorisées`,
      },
      { status: 409, headers: NO_STORE }
    );
  }

  const sets: string[] = [];
  const args: unknown[] = [];
  function pushSet(col: string, val: unknown) {
    args.push(val);
    sets.push(`${col} = $${args.length}`);
  }
  const beforeSnapshot: Record<string, unknown> = {};
  const afterSnapshot: Record<string, unknown> = {};

  for (const [k, dbCol] of Object.entries(FIELD_MAP)) {
    if (!(k in body)) continue;
    const v = body[k];
    if (v === undefined) continue;

    if (k === "status") {
      pushSet(dbCol, v);
      beforeSnapshot.status = currentStatus;
      afterSnapshot.status = v;
      continue;
    }
    if (k === "validUntil") {
      if (v === null || v === "") {
        sets.push(`${dbCol} = NULL`);
        afterSnapshot.validUntil = null;
        continue;
      }
      if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v))
        return Response.json({ error: "validUntil doit etre YYYY-MM-DD ou null" }, { status: 400, headers: NO_STORE });
      pushSet(dbCol, v);
      afterSnapshot.validUntil = v;
      continue;
    }
    if (k === "clientName" || k === "title") {
      if (typeof v !== "string" || !v.trim())
        return Response.json({ error: `${k} doit etre une chaine non vide` }, { status: 400, headers: NO_STORE });
      pushSet(dbCol, v.trim());
      afterSnapshot[k] = v.trim();
      continue;
    }
    if (v === null) {
      sets.push(`${dbCol} = NULL`);
      afterSnapshot[k] = null;
    } else {
      pushSet(dbCol, String(v));
      afterSnapshot[k] = String(v);
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
    await adminQuery(
      `UPDATE core.vlm_quotes SET ${sets.join(", ")} WHERE id = $${args.length}`,
      args
    );

    // Audit : status_changed prioritaire, sinon quote_updated
    const eventType =
      requestedStatus !== null && requestedStatus !== currentStatus
        ? "quote_status_changed"
        : "quote_updated";
    await logVlmQuoteEvent({
      tenantId: existing.tenant_id,
      quoteId: id,
      actorEmail: auth.email,
      eventType,
      before: beforeSnapshot,
      after: afterSnapshot,
    });

    // Si on passe à 'cancelled', on log aussi quote_cancelled (audit clair)
    if (requestedStatus === "cancelled" && currentStatus !== "cancelled") {
      await logVlmQuoteEvent({
        tenantId: existing.tenant_id,
        quoteId: id,
        actorEmail: auth.email,
        eventType: "quote_cancelled",
        before: { status: currentStatus },
      });
    }

    const updated = await getVlmQuote(id);
    return Response.json({ item: updated }, { headers: NO_STORE });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur DB" },
      { status: 502, headers: NO_STORE }
    );
  }
}
