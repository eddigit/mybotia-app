// Bloc 7H — VLM quote line : PATCH + DELETE (DELETE seulement si quote.status='draft').

import { adminQuery } from "@/lib/admin-db";
import { requireVlmAccess } from "@/lib/vlm-access";
import { getVlmQuoteRow, getVlmQuoteLineRow, mapLine, LINE_COLS } from "@/lib/vlm-quote-data";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

const FIELD_MAP: Record<string, string> = {
  label: "label",
  description: "description",
  quantity: "quantity",
  unit: "unit",
  unitPriceHt: "unit_price_ht",
  vatRate: "vat_rate",
  sortOrder: "sort_order",
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const auth = await requireVlmAccess();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  const { id: quoteId, lineId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(quoteId) || !/^[0-9a-f-]{36}$/i.test(lineId)) {
    return Response.json({ error: "id invalide" }, { status: 400, headers: NO_STORE });
  }

  // Vérifier accès au devis (tenant vlmedical) et existence ligne
  const quote = await getVlmQuoteRow(quoteId);
  if (!quote) return Response.json({ error: "devis introuvable" }, { status: 404, headers: NO_STORE });
  const line = await getVlmQuoteLineRow(quoteId, lineId);
  if (!line) return Response.json({ error: "ligne introuvable" }, { status: 404, headers: NO_STORE });

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

    if (k === "quantity" || k === "unitPriceHt" || k === "vatRate" || k === "sortOrder") {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n) || (k !== "sortOrder" && n < 0))
        return Response.json({ error: `${k} doit etre >= 0` }, { status: 400, headers: NO_STORE });
      pushSet(dbCol, k === "sortOrder" ? Math.floor(n) : n);
      continue;
    }
    if (k === "label") {
      if (typeof v !== "string" || !v.trim())
        return Response.json({ error: "label doit etre une chaine non vide" }, { status: 400, headers: NO_STORE });
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
  // updated_at sera géré par le trigger compute_vlm_quote_line_totals s'il y a
  // changement de quantité/prix/tva. Sinon on l'ajoute explicitement ici.
  sets.push(`updated_at = now()`);

  try {
    args.push(lineId);
    await adminQuery(
      `UPDATE core.vlm_quote_lines SET ${sets.join(", ")} WHERE id = $${args.length}`,
      args
    );
    const rows = await adminQuery<Parameters<typeof mapLine>[0]>(
      `SELECT ${LINE_COLS} FROM core.vlm_quote_lines l WHERE l.id = $1`,
      [lineId]
    );
    return Response.json({ item: mapLine(rows[0]) }, { headers: NO_STORE });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur DB" },
      { status: 502, headers: NO_STORE }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const auth = await requireVlmAccess();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  const { id: quoteId, lineId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(quoteId) || !/^[0-9a-f-]{36}$/i.test(lineId)) {
    return Response.json({ error: "id invalide" }, { status: 400, headers: NO_STORE });
  }

  const quote = await getVlmQuoteRow(quoteId);
  if (!quote) return Response.json({ error: "devis introuvable" }, { status: 404, headers: NO_STORE });
  if (quote.status !== "draft") {
    return Response.json(
      { error: "suppression de ligne autorisee uniquement sur un devis draft" },
      { status: 409, headers: NO_STORE }
    );
  }
  const line = await getVlmQuoteLineRow(quoteId, lineId);
  if (!line) return Response.json({ error: "ligne introuvable" }, { status: 404, headers: NO_STORE });

  try {
    await adminQuery("DELETE FROM core.vlm_quote_lines WHERE id = $1", [lineId]);
    return Response.json({ ok: true }, { headers: NO_STORE });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur DB" },
      { status: 502, headers: NO_STORE }
    );
  }
}
