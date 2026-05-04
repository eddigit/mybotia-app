-- =============================================================================
-- UB-9bis — Hardening DB billing avant UB-10 bridge
-- Date    : 2026-05-04
-- Branch  : feature/usage-billing-v3-ub2
-- Backup  : /opt/mybotia/backups/pg/mybotia_core-pre-ub9bis-20260504-230515.sql.gz
--
-- Pré-check exécuté : 0 tenant avec >1 sub ai_collaborator active.
--
-- Contenu :
--   1. Index unique partiel sur core.subscriptions (anti-doublon ai_collaborator active).
--   2. CREATE OR REPLACE VIEW billing.ai_usage_monthly_summary :
--      utilise s.ai_markup_rate du tenant ; fallback 1.20 final.
--
-- Compatibilité :
--   - Index : aucun doublon en base, création garantie.
--   - Vue : LEFT JOIN sur subs active → si pas de sub, ai_markup_rate=NULL,
--           COALESCE bascule à 1.20 (comportement UB-2 préservé pour anciens
--           tenants non configurés).
-- =============================================================================

BEGIN;

-- 1. Anti-doublon : 1 sub ai_collaborator active max par tenant.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_ai_collaborator
  ON core.subscriptions(tenant_id)
  WHERE category = 'ai_collaborator' AND status = 'active';

COMMENT ON INDEX core.uniq_active_ai_collaborator IS
  'UB-9bis (2026-05-04) — Garantit 1 seule subscription ai_collaborator active par tenant. Doublon → INSERT/UPDATE refusé Postgres.';

-- 2. Vue corrigée : utilise s.ai_markup_rate quand disponible.
CREATE OR REPLACE VIEW billing.ai_usage_monthly_summary AS
SELECT
  tu.tenant_id,
  t.slug                                                            AS tenant_slug,
  tu.agent_slug,
  date_trunc('month', tu.usage_date)::date                          AS month,
  tu.service_tier,
  SUM(tu.tokens_input)                                              AS tokens_input,
  SUM(tu.tokens_output)                                             AS tokens_output,
  SUM(tu.tokens_total)                                              AS tokens_total,
  SUM(tu.estimated_cost)                                            AS api_cost_estimated,
  SUM(
    COALESCE(
      tu.client_cost_estimated,
      COALESCE(tu.estimated_cost, 0) * COALESCE(s.ai_markup_rate, 1.20)
    )
  )                                                                 AS client_cost_estimated,
  SUM(tu.request_count)                                             AS request_count
FROM core.token_usage tu
LEFT JOIN core.tenant t ON t.id = tu.tenant_id
LEFT JOIN core.subscriptions s
       ON s.tenant_id = tu.tenant_id
      AND s.category = 'ai_collaborator'
      AND s.status   = 'active'
GROUP BY tu.tenant_id, t.slug, tu.agent_slug,
         date_trunc('month', tu.usage_date), tu.service_tier;

COMMENT ON VIEW billing.ai_usage_monthly_summary IS
  'UB-9bis — Agrégat mensuel par tenant/agent/service_tier. Markup lu sur sub ai_collaborator active (jointure 1:0..1 garantie par uniq_active_ai_collaborator). Fallback final 1.20.';

COMMIT;
