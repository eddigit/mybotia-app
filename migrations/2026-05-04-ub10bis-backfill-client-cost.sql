-- =============================================================================
-- UB-10bis — Backfill client_cost_estimated historique
-- Date    : 2026-05-04
-- Branch  : feature/usage-billing-v3-ub2
-- Backup  : /opt/mybotia/backups/pg/mybotia_core-pre-ub10bis-20260504-234022.sql.gz
--
-- Contexte :
--   UB-10 (commit 168c04c) a câblé le bridge pour écrire
--   client_cost_estimated = estimated_cost × markup au prochain UPSERT.
--   PROBLEME : l'UPSERT cumule client_cost_estimated, donc les rows
--   pré-UB-10 (avec estimated_cost cumulé mais client_cost NULL) ne
--   reflétaient que le delta post-UB-10 dans la vue UB-9bis.
--   Effet : /api/billing/usage affichait 1.27€ au lieu de 29.29€ pour mybotia.
--
-- Correction :
--   Backfill idempotent — set client_cost_estimated = estimated_cost × markup
--   pour toutes les rows historiques où la valeur est NULL ou inférieure
--   au montant attendu (markup tenant ou fallback 1.20).
--
-- Idempotent : ré-exécution → 0 row impactée si tout est déjà cohérent.
-- =============================================================================

BEGIN;

WITH tenant_markup AS (
  SELECT t.id AS tenant_id,
         COALESCE(s.ai_markup_rate, 1.20) AS markup
    FROM core.tenant t
    LEFT JOIN core.subscriptions s
           ON s.tenant_id = t.id
          AND s.category = 'ai_collaborator'
          AND s.status   = 'active'
)
UPDATE core.token_usage tu
   SET client_cost_estimated = ROUND((tu.estimated_cost * tm.markup)::numeric, 6)
  FROM tenant_markup tm
 WHERE tm.tenant_id = tu.tenant_id
   AND tu.estimated_cost IS NOT NULL
   AND tu.estimated_cost > 0
   AND (tu.client_cost_estimated IS NULL
        OR tu.client_cost_estimated < tu.estimated_cost * tm.markup);

COMMIT;

-- Vérification post-UPDATE attendue :
--   mybotia/lea/claude-opus-4-7   : 24.333206 → client_cost 29.199847
--   mybotia/lea/claude-sonnet-4-6 :  0.075000 → client_cost  0.090000
--   vlmedical/max/claude-sonnet-4-6: 0.789277 → client_cost  0.947132
