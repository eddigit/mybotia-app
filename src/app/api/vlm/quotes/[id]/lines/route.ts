// Bloc 7H — VLM quote lines : POST création.

import { adminQuery } from "@/lib/admin-db";
import { requireVlmAccess } from "@/lib/vlm-access";
import { getVlmQuoteRow, mapLine, LINE_COLS } from "@/lib/vlm-quote-data";
import { isQuoteEditable, logVlmQuoteEvent } from "@/lib/vlm-quote-events";
import type { VlmQuoteStatus } from "@/lib/vlm-quote-types";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

interface CreateLineBody {
  catalogItemId?: string | null;
  label: string;
  description?: string | null;
  quantity?: number;
  unit?: string | null;
  unitPriceHt?: number;
  vatRate?: number;
  sortOrder?: number;
}

function validateCreate(body: unknown): { ok: true; data: CreateLineBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "body invalide" };
  const b = body as Record<string, unknown>;
  if (typeof b.label !== "string" || !b.label.trim())
    return { ok: false, error: "label requis" };
  const quantity = b.quantity !== undefined ? Number(b.quantity) : 1;
  if (!Number.isFinite(quantity) || quantity < 0)
    return { ok: false, error: "quantity doit etre >= 0" };
  const unitPriceHt = b.unitPriceHt !== undefined ? Number(b.unitPriceHt) : 0;
  if (!Number.isFinite(unitPriceHt) || unitPriceHt < 0)
    return { ok: false, error: "unitPriceHt doit etre >= 0" };
  const vatRate = b.vatRate !== undefined ? Number(b.vatRate) : 20;
  if (!Number.isFinite(vatRate) || vatRate < 0)
    return { ok: false, error: "vatRate doit etre >= 0" };
  const sortOrder = b.sortOrder !== undefined ? Number(b.sortOrder) : 0;
  const catalogItemId =
    typeof b.catalogItemId === "string" && /^[0-9a-f-]{36}$/i.test(b.catalogItemId) ? b.catalogItemId : null;
  return {
    ok: true,
    data: {
      catalogItemId,
      label: b.label.trim(),
      description: typeof b.description === "string" ? b.description : null,
      quantity,
      unit: typeof b.unit === "string" && b.unit.trim() ? b.unit.trim() : null,
      unitPriceHt,
      vatRate,
      sortOrder: Number.isFinite(sortOrder) ? Math.floor(sortOrder) : 0,
    },
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireVlmAccess();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  const { id: quoteId } = await params;
  if (!quoteId || !/^[0-9a-f-]{36}$/i.test(quoteId)) {
    return Response.json({ error: "id devis invalide" }, { status: 400, headers: NO_STORE });
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

  // Vérifier que le devis existe + tenant vlmedical
  const quote = await getVlmQuoteRow(quoteId);
  if (!quote) {
    return Response.json({ error: "devis introuvable" }, { status: 404, headers: NO_STORE });
  }

  // Bloc 7J — verrouillage workflow : ajout de ligne autorisé seulement si draft
  if (!isQuoteEditable(quote.status as VlmQuoteStatus)) {
    return Response.json(
      {
        error: `devis verrouillé (status=${quote.status}) — ajout de ligne refusé`,
      },
      { status: 409, headers: NO_STORE }
    );
  }

  try {
    const inserted = await adminQuery<{ r_id: string }>(
      `INSERT INTO core.vlm_quote_lines
         (tenant_id, quote_id, catalog_item_id, label, description,
          quantity, unit, unit_price_ht, vat_rate, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id AS r_id`,
      [
        quote.tenant_id,
        quoteId,
        d.catalogItemId,
        d.label,
        d.description,
        d.quantity,
        d.unit,
        d.unitPriceHt,
        d.vatRate,
        d.sortOrder,
      ]
    );
    const newId = inserted[0].r_id;
    const rows = await adminQuery<Parameters<typeof mapLine>[0]>(
      `SELECT ${LINE_COLS} FROM core.vlm_quote_lines l WHERE l.id = $1`,
      [newId]
    );
    await logVlmQuoteEvent({
      tenantId: quote.tenant_id,
      quoteId,
      actorEmail: auth.email,
      eventType: "line_added",
      after: {
        lineId: newId,
        label: d.label,
        quantity: d.quantity,
        unitPriceHt: d.unitPriceHt,
        vatRate: d.vatRate,
      },
    });
    return Response.json({ item: mapLine(rows[0]) }, { status: 201, headers: NO_STORE });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur DB";
    const status = /cross_tenant_reference/i.test(msg) ? 400 : 502;
    return Response.json({ error: msg }, { status, headers: NO_STORE });
  }
}
