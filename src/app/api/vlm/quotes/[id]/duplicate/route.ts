// Bloc 7K — Duplication de devis VLM.
// Crée un clone status='draft' avec une nouvelle ref, copie toutes les lignes.
// Les events ne sont pas copiés ; un event quote_created est écrit sur le clone
// avec after.duplicatedFromQuoteId.

import { adminQuery } from "@/lib/admin-db";
import { requireVlmAccess } from "@/lib/vlm-access";
import { generateVlmQuoteRef } from "@/lib/vlm-quote-ref";
import { getVlmQuote } from "@/lib/vlm-quote-data";
import { logVlmQuoteEvent } from "@/lib/vlm-quote-events";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

interface SourceQuoteRow {
  id: string;
  tenant_id: string;
  deal_id: string | null;
  ref: string;
  client_name: string;
  client_email: string | null;
  client_address: string | null;
  title: string;
  currency: string;
  valid_until: string | null;
  notes: string | null;
  terms: string | null;
}

interface SourceLineRow {
  catalog_item_id: string | null;
  label: string;
  description: string | null;
  quantity: string;
  unit: string | null;
  unit_price_ht: string;
  vat_rate: string;
  sort_order: number;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireVlmAccess();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  const { id } = await params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ error: "id devis invalide" }, { status: 400, headers: NO_STORE });
  }

  // Charger le devis source + tenant guard
  const sourceRows = await adminQuery<SourceQuoteRow>(
    `SELECT q.id, q.tenant_id, q.deal_id, q.ref,
            q.client_name, q.client_email, q.client_address,
            q.title, q.currency,
            to_char(q.valid_until, 'YYYY-MM-DD') AS valid_until,
            q.notes, q.terms
       FROM core.vlm_quotes q
       JOIN core.tenant t ON t.id = q.tenant_id
      WHERE q.id = $1 AND t.slug = 'vlmedical'`,
    [id]
  );
  const source = sourceRows[0];
  if (!source) {
    return Response.json(
      { error: "devis source introuvable ou hors tenant vlmedical" },
      { status: 404, headers: NO_STORE }
    );
  }

  // Charger les lignes source
  const sourceLines = await adminQuery<SourceLineRow>(
    `SELECT catalog_item_id, label, description,
            quantity, unit, unit_price_ht, vat_rate, sort_order
       FROM core.vlm_quote_lines
      WHERE quote_id = $1
      ORDER BY sort_order, created_at`,
    [id]
  );

  try {
    const newRef = await generateVlmQuoteRef();

    const cloneTitle = `Variante de ${source.ref}`;
    const cloneNotes = source.notes
      ? `Dupliqué depuis ${source.ref}.\n${source.notes}`
      : `Dupliqué depuis ${source.ref}.`;

    // Créer le clone (status='draft' forcé)
    const inserted = await adminQuery<{ r_id: string }>(
      `INSERT INTO core.vlm_quotes
         (tenant_id, deal_id, ref, client_name, client_email, client_address,
          title, status, currency, valid_until, notes, terms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'draft',$8,$9,$10,$11)
       RETURNING id AS r_id`,
      [
        source.tenant_id,
        source.deal_id,
        newRef,
        source.client_name,
        source.client_email,
        source.client_address,
        cloneTitle,
        source.currency,
        source.valid_until,
        cloneNotes,
        source.terms,
      ]
    );
    const cloneId = inserted[0].r_id;

    // Copier les lignes (les triggers DB recalculent les totaux à chaque INSERT)
    for (const line of sourceLines) {
      await adminQuery(
        `INSERT INTO core.vlm_quote_lines
           (tenant_id, quote_id, catalog_item_id, label, description,
            quantity, unit, unit_price_ht, vat_rate, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          source.tenant_id,
          cloneId,
          line.catalog_item_id,
          line.label,
          line.description,
          parseFloat(line.quantity) || 0,
          line.unit,
          parseFloat(line.unit_price_ht) || 0,
          parseFloat(line.vat_rate) || 0,
          line.sort_order,
        ]
      );
    }

    // Audit event sur le clone (pas sur la source)
    await logVlmQuoteEvent({
      tenantId: source.tenant_id,
      quoteId: cloneId,
      actorEmail: auth.email,
      eventType: "quote_created",
      after: {
        ref: newRef,
        sourceRef: source.ref,
        sourceQuoteId: source.id,
        duplicatedFromQuoteId: source.id,
        linesCount: sourceLines.length,
      },
    });

    const clone = await getVlmQuote(cloneId);
    return Response.json(
      { item: clone, sourceQuoteId: source.id, sourceRef: source.ref },
      { status: 201, headers: NO_STORE }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur DB";
    const status = /unique|duplicate/i.test(msg) ? 409 : /cross_tenant_reference/i.test(msg) ? 400 : 502;
    return Response.json({ error: msg }, { status, headers: NO_STORE });
  }
}
