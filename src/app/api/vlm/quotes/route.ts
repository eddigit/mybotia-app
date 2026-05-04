// Bloc 7H — VLM quotes : GET liste + POST création.

import { adminQuery } from "@/lib/admin-db";
import { requireVlmAccess, VLM_SLUG } from "@/lib/vlm-access";
import { generateVlmQuoteRef } from "@/lib/vlm-quote-ref";
import { listVlmQuotes, getVlmQuote } from "@/lib/vlm-quote-data";
import { VLM_QUOTE_STATUSES, type VlmQuoteStatus } from "@/lib/vlm-quote-types";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

export async function GET() {
  const auth = await requireVlmAccess();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  try {
    const items = await listVlmQuotes();
    return Response.json({ items }, { headers: NO_STORE });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur DB" },
      { status: 502, headers: NO_STORE }
    );
  }
}

interface CreateBody {
  dealId?: string | null;
  clientName: string;
  clientEmail?: string | null;
  clientAddress?: string | null;
  title: string;
  status?: VlmQuoteStatus;
  currency?: string;
  validUntil?: string | null;
  notes?: string | null;
  terms?: string | null;
}

function validateCreate(body: unknown): { ok: true; data: CreateBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "body invalide" };
  const b = body as Record<string, unknown>;
  if (typeof b.clientName !== "string" || !b.clientName.trim())
    return { ok: false, error: "clientName requis" };
  if (typeof b.title !== "string" || !b.title.trim())
    return { ok: false, error: "title requis" };
  const status = typeof b.status === "string" ? b.status : "draft";
  if (!VLM_QUOTE_STATUSES.includes(status as VlmQuoteStatus))
    return { ok: false, error: `status invalide (allowed: ${VLM_QUOTE_STATUSES.join(", ")})` };
  let validUntil: string | null = null;
  if (typeof b.validUntil === "string" && b.validUntil.trim()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.validUntil))
      return { ok: false, error: "validUntil doit etre YYYY-MM-DD ou vide" };
    validUntil = b.validUntil;
  }
  const dealId =
    typeof b.dealId === "string" && /^[0-9a-f-]{36}$/i.test(b.dealId) ? b.dealId : null;
  return {
    ok: true,
    data: {
      dealId,
      clientName: b.clientName.trim(),
      clientEmail: typeof b.clientEmail === "string" && b.clientEmail.trim() ? b.clientEmail.trim() : null,
      clientAddress: typeof b.clientAddress === "string" && b.clientAddress.trim() ? b.clientAddress.trim() : null,
      title: b.title.trim(),
      status: status as VlmQuoteStatus,
      currency: typeof b.currency === "string" && b.currency ? b.currency : "EUR",
      validUntil,
      notes: typeof b.notes === "string" ? b.notes : null,
      terms: typeof b.terms === "string" ? b.terms : null,
    },
  };
}

export async function POST(request: Request) {
  const auth = await requireVlmAccess();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
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

  try {
    const tenantRows = await adminQuery<{ id: string }>(
      "SELECT id FROM core.tenant WHERE slug = $1",
      [VLM_SLUG]
    );
    if (!tenantRows[0]) {
      return Response.json({ error: "tenant vlmedical introuvable" }, { status: 404, headers: NO_STORE });
    }
    const tenantId = tenantRows[0].id;

    // Check deal cohérence (le trigger DB le fait aussi mais on retourne 400 propre)
    if (d.dealId) {
      const dealCheck = await adminQuery<{ id: string }>(
        "SELECT id FROM core.vlm_container_deals WHERE id = $1 AND tenant_id = $2",
        [d.dealId, tenantId]
      );
      if (!dealCheck[0]) {
        return Response.json({ error: "dealId hors tenant vlmedical" }, { status: 400, headers: NO_STORE });
      }
    }

    const ref = await generateVlmQuoteRef();

    const inserted = await adminQuery<{ r_id: string }>(
      `INSERT INTO core.vlm_quotes
         (tenant_id, deal_id, ref, client_name, client_email, client_address,
          title, status, currency, valid_until, notes, terms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id AS r_id`,
      [
        tenantId,
        d.dealId,
        ref,
        d.clientName,
        d.clientEmail,
        d.clientAddress,
        d.title,
        d.status,
        d.currency,
        d.validUntil,
        d.notes,
        d.terms,
      ]
    );
    const quote = await getVlmQuote(inserted[0].r_id);
    return Response.json({ item: quote }, { status: 201, headers: NO_STORE });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur DB";
    const status = /unique|duplicate/i.test(msg) ? 409 : /cross_tenant_reference/i.test(msg) ? 400 : 502;
    return Response.json({ error: msg }, { status, headers: NO_STORE });
  }
}
