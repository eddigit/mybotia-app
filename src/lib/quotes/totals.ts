/**
 * V1.1.F — calcul des totaux devis côté client cockpit (live preview).
 *
 * Source : copy/paste depuis `mybotia-business/src/lib/quotes/totals.ts`
 * (commit V1.1.E). Le serveur business reste seul juge des montants persistés
 * (cf. `tenantMutation` qui recalcule via `computeQuoteTotals`). Cette copie
 * front sert UNIQUEMENT au feedback live dans CreateQuoteModal /
 * EditQuoteModal pour afficher HT / TVA / TTC pendant la saisie.
 *
 * Comportement strict identique pour éviter toute divergence affichée vs
 * persisté. Si tu modifies l'un, modifie l'autre.
 */

export type QuoteItemInput = {
  label: string;
  description?: string | null;
  qty: number;
  unitPriceHt: number;
  vatRate: number;
};

export type QuoteItemComputed = QuoteItemInput & {
  lineHt: number;
  lineVat: number;
  lineTtc: number;
};

export type QuoteTotals = {
  subtotalHt: number;
  vatTotal: number;
  totalTtc: number;
  items: QuoteItemComputed[];
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeQuoteTotals(items: QuoteItemInput[]): QuoteTotals {
  const computed: QuoteItemComputed[] = items.map((it) => {
    const qty = Number(it.qty) || 0;
    const unit = Number(it.unitPriceHt) || 0;
    const vatRate = Number(it.vatRate) || 0;
    const lineHt = round2(qty * unit);
    const lineVat = round2((lineHt * vatRate) / 100);
    const lineTtc = round2(lineHt + lineVat);
    return { ...it, lineHt, lineVat, lineTtc };
  });

  const subtotalHt = round2(computed.reduce((s, it) => s + it.lineHt, 0));
  const vatTotal = round2(computed.reduce((s, it) => s + it.lineVat, 0));
  const totalTtc = round2(computed.reduce((s, it) => s + it.lineTtc, 0));

  return { subtotalHt, vatTotal, totalTtc, items: computed };
}

export function toMoneyString(n: number): string {
  return n.toFixed(2);
}
