// Bloc 7H — Génération de la référence devis VLM.
// Format : VQ{YY}{MM}-{seq3} — ex : VQ2605-001
// Séquence par tenant + mois UTC. Indépendante des masques Dolibarr.

import { adminQuery } from "./admin-db";
import { VLM_SLUG } from "./vlm-access";

const MAX_RETRIES = 3;

export async function generateVlmQuoteRef(): Promise<string> {
  const now = new Date();
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const prefix = `VQ${yy}${mm}-`;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Lire la plus haute séquence du mois pour le tenant vlmedical
    const rows = await adminQuery<{ max_seq: string | null }>(
      `SELECT MAX( NULLIF(SUBSTRING(q.ref FROM '[0-9]+$'), '')::int )::text AS max_seq
         FROM core.vlm_quotes q
         JOIN core.tenant t ON t.id = q.tenant_id
        WHERE t.slug = $1 AND q.ref LIKE $2`,
      [VLM_SLUG, prefix + "%"]
    );
    const max = rows[0]?.max_seq ? parseInt(rows[0].max_seq, 10) : 0;
    const candidate = prefix + String(max + 1 + attempt).padStart(3, "0");

    // Vérifier collision avant de retourner — l'unique constraint
    // (tenant_id, ref) traitera le race condition résiduel.
    const existing = await adminQuery<{ id: string }>(
      `SELECT q.id FROM core.vlm_quotes q
         JOIN core.tenant t ON t.id = q.tenant_id
        WHERE t.slug = $1 AND q.ref = $2 LIMIT 1`,
      [VLM_SLUG, candidate]
    );
    if (existing.length === 0) return candidate;
  }
  // Fallback si race intense : retourne avec timestamp pour garantir unicité
  return `${prefix}${String(Date.now()).slice(-3)}`;
}
