// Bloc 7I — Conversion deal container → devis pré-rempli.
// POST /api/vlm/quotes/from-deal { dealId, mode? }
// Mode : 'sale_amount' (1 ligne vente) ou 'cost_breakdown' (lignes coûts).
// Default : 'sale_amount' si deal.sale_amount > 0, sinon 'cost_breakdown'.

import { adminQuery } from "@/lib/admin-db";
import { requireVlmAccess, VLM_SLUG } from "@/lib/vlm-access";
import { generateVlmQuoteRef } from "@/lib/vlm-quote-ref";
import { getVlmQuote } from "@/lib/vlm-quote-data";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

const DEFAULT_TERMS =
  "Devis valable selon disponibilité, transport et conditions douanières.";

interface DealRow {
  id: string;
  tenant_id: string;
  ref: string | null;
  title: string;
  supplier_name: string | null;
  origin_country: string | null;
  destination_country: string | null;
  container_type: string | null;
  status: string;
  currency: string;
  purchase_amount: string | null;
  transport_cost: string | null;
  customs_cost: string | null;
  insurance_cost: string | null;
  conditioning_cost: string | null;
  other_cost: string | null;
  sale_amount: string | null;
}

function num(v: string | null): number {
  return v === null ? 0 : parseFloat(v) || 0;
}

interface ProposedLine {
  label: string;
  description?: string | null;
  quantity: number;
  unit: string | null;
  unit_price_ht: number;
  vat_rate: number;
  sort_order: number;
}

function buildLines(deal: DealRow, mode: "sale_amount" | "cost_breakdown"): ProposedLine[] {
  if (mode === "sale_amount") {
    return [
      {
        label: deal.title || "Vente container",
        description: deal.container_type
          ? `Container ${deal.container_type}${deal.origin_country ? ` · ${deal.origin_country}` : ""}${deal.destination_country ? ` → ${deal.destination_country}` : ""}`
          : null,
        quantity: 1,
        unit: "container",
        unit_price_ht: num(deal.sale_amount),
        vat_rate: 20,
        sort_order: 0,
      },
    ];
  }
  // cost_breakdown : 1 ligne par coût non null
  const lines: ProposedLine[] = [];
  const candidates: Array<[string, number]> = [
    ["Produits / lot container", num(deal.purchase_amount)],
    ["Transport", num(deal.transport_cost)],
    ["Frais douane", num(deal.customs_cost)],
    ["Assurance", num(deal.insurance_cost)],
    ["Conditionnement", num(deal.conditioning_cost)],
    ["Frais divers", num(deal.other_cost)],
  ];
  let order = 0;
  for (const [label, amount] of candidates) {
    if (amount > 0) {
      lines.push({
        label,
        quantity: 1,
        unit: null,
        unit_price_ht: amount,
        vat_rate: 20,
        sort_order: order++,
      });
    }
  }
  return lines;
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
  const b = (body || {}) as Record<string, unknown>;
  const dealId = typeof b.dealId === "string" ? b.dealId : "";
  if (!/^[0-9a-f-]{36}$/i.test(dealId)) {
    return Response.json({ error: "dealId invalide" }, { status: 400, headers: NO_STORE });
  }
  const requestedMode =
    typeof b.mode === "string" && (b.mode === "sale_amount" || b.mode === "cost_breakdown")
      ? (b.mode as "sale_amount" | "cost_breakdown")
      : null;

  // Charger le deal + vérifier tenant=vlmedical
  const dealRows = await adminQuery<DealRow>(
    `SELECT cd.id, cd.tenant_id, cd.ref, cd.title,
            cd.supplier_name, cd.origin_country, cd.destination_country,
            cd.container_type, cd.status, cd.currency,
            cd.purchase_amount, cd.transport_cost, cd.customs_cost,
            cd.insurance_cost, cd.conditioning_cost, cd.other_cost,
            cd.sale_amount
       FROM core.vlm_container_deals cd
       JOIN core.tenant t ON t.id = cd.tenant_id
      WHERE cd.id = $1 AND t.slug = $2`,
    [dealId, VLM_SLUG]
  );
  const deal = dealRows[0];
  if (!deal) {
    return Response.json(
      { error: "deal introuvable ou hors tenant vlmedical" },
      { status: 404, headers: NO_STORE }
    );
  }

  // Mode auto : sale_amount si > 0, sinon cost_breakdown
  const sale = num(deal.sale_amount);
  const mode: "sale_amount" | "cost_breakdown" =
    requestedMode || (sale > 0 ? "sale_amount" : "cost_breakdown");

  const lines = buildLines(deal, mode);

  const proposalNote =
    mode === "sale_amount"
      ? `Devis généré depuis le deal container ${deal.ref || deal.id.slice(0, 8)}.`
      : `Devis généré depuis le deal container ${deal.ref || deal.id.slice(0, 8)}. Lignes basées sur les coûts internes — à ajuster commercialement avant envoi.`;

  // Création quote + lignes en série (les triggers DB recalculent les totaux automatiquement)
  try {
    const ref = await generateVlmQuoteRef();
    const inserted = await adminQuery<{ r_id: string }>(
      `INSERT INTO core.vlm_quotes
         (tenant_id, deal_id, ref, client_name, title, status, currency, notes, terms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id AS r_id`,
      [
        deal.tenant_id,
        deal.id,
        ref,
        deal.supplier_name && deal.supplier_name.trim() ? deal.supplier_name.trim() : "Client à renseigner",
        deal.title || `Devis ${ref}`,
        "draft",
        deal.currency || "EUR",
        proposalNote,
        DEFAULT_TERMS,
      ]
    );
    const quoteId = inserted[0].r_id;

    for (const line of lines) {
      await adminQuery(
        `INSERT INTO core.vlm_quote_lines
           (tenant_id, quote_id, label, description, quantity, unit, unit_price_ht, vat_rate, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          deal.tenant_id,
          quoteId,
          line.label,
          line.description ?? null,
          line.quantity,
          line.unit,
          line.unit_price_ht,
          line.vat_rate,
          line.sort_order,
        ]
      );
    }

    const quote = await getVlmQuote(quoteId);
    return Response.json(
      { item: quote, mode, fromDealRef: deal.ref || null },
      { status: 201, headers: NO_STORE }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur DB";
    const status = /unique|duplicate/i.test(msg) ? 409 : /cross_tenant_reference/i.test(msg) ? 400 : 502;
    return Response.json({ error: msg }, { status, headers: NO_STORE });
  }
}
