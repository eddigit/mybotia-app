-- =============================================================================
-- UB-2 — Migration DB minimale Usage & Billing V3
-- Date    : 2026-05-04
-- Branch  : feature/usage-billing-v3-ub2
-- Backup  : /opt/mybotia/backups/pg/mybotia_core-pre-ub2-20260504-215242.sql.gz
--
-- Décisions Gilles validées :
--   1. Cohabitation tokens (legacy/audit) + euros (UI commerciale).
--   2. core.token_usage étendu en colonnes NULLABLE, pas de backfill.
--
-- Contraintes :
--   - Idempotent (IF NOT EXISTS partout).
--   - Aucune DROP, aucune ALTER destructive.
--   - Aucune route API ni UI touchée.
--   - Pas de CHECK strict sur les nouveaux codes/modes (validation app-side).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Étendre core.subscriptions avec champs euro-first
-- -----------------------------------------------------------------------------
ALTER TABLE core.subscriptions
  ADD COLUMN IF NOT EXISTS ai_budget_monthly_eur        numeric(12,2),
  ADD COLUMN IF NOT EXISTS ai_budget_mode               text          DEFAULT 'fixed_budget',
  ADD COLUMN IF NOT EXISTS ai_markup_rate               numeric(5,2)  DEFAULT 1.20,
  ADD COLUMN IF NOT EXISTS budget_per_establishment_eur numeric(12,2),
  ADD COLUMN IF NOT EXISTS establishment_count          integer,
  ADD COLUMN IF NOT EXISTS soft_limit_percent           integer       DEFAULT 70,
  ADD COLUMN IF NOT EXISTS hard_limit_percent           integer       DEFAULT 100,
  ADD COLUMN IF NOT EXISTS recharge_enabled             boolean       DEFAULT true,
  ADD COLUMN IF NOT EXISTS business_plan_code           text,
  ADD COLUMN IF NOT EXISTS business_plan_label          text;

-- Garde-fous valeur (tolérants : NULL accepté)
ALTER TABLE core.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_ai_budget_monthly_eur_check;
ALTER TABLE core.subscriptions
  ADD  CONSTRAINT subscriptions_ai_budget_monthly_eur_check
       CHECK (ai_budget_monthly_eur IS NULL OR ai_budget_monthly_eur >= 0);

ALTER TABLE core.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_ai_markup_rate_check;
ALTER TABLE core.subscriptions
  ADD  CONSTRAINT subscriptions_ai_markup_rate_check
       CHECK (ai_markup_rate IS NULL OR ai_markup_rate >= 0);

ALTER TABLE core.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_budget_per_etab_check;
ALTER TABLE core.subscriptions
  ADD  CONSTRAINT subscriptions_budget_per_etab_check
       CHECK (budget_per_establishment_eur IS NULL OR budget_per_establishment_eur >= 0);

ALTER TABLE core.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_establishment_count_check;
ALTER TABLE core.subscriptions
  ADD  CONSTRAINT subscriptions_establishment_count_check
       CHECK (establishment_count IS NULL OR establishment_count >= 0);

ALTER TABLE core.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_soft_limit_check;
ALTER TABLE core.subscriptions
  ADD  CONSTRAINT subscriptions_soft_limit_check
       CHECK (soft_limit_percent  IS NULL OR (soft_limit_percent  BETWEEN 0 AND 1000));

ALTER TABLE core.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_hard_limit_check;
ALTER TABLE core.subscriptions
  ADD  CONSTRAINT subscriptions_hard_limit_check
       CHECK (hard_limit_percent  IS NULL OR (hard_limit_percent  BETWEEN 0 AND 1000));

COMMENT ON COLUMN core.subscriptions.ai_budget_monthly_eur        IS 'Budget IA mensuel total en euros (UB-2). Source pour la vue client.';
COMMENT ON COLUMN core.subscriptions.ai_budget_mode               IS 'Mode de calcul du budget: solo|equipe|service|per_establishment|custom|fixed_budget. Validation app-side.';
COMMENT ON COLUMN core.subscriptions.ai_markup_rate               IS 'Coefficient supervision: client_cost = api_cost × markup. Defaut 1.20.';
COMMENT ON COLUMN core.subscriptions.budget_per_establishment_eur IS 'Si mode per_establishment: budget par établissement (cas IGH).';
COMMENT ON COLUMN core.subscriptions.establishment_count          IS 'Nombre d''établissements/entités (cas IGH=20).';
COMMENT ON COLUMN core.subscriptions.soft_limit_percent           IS 'Seuil alerte douce sur consommation (defaut 70%).';
COMMENT ON COLUMN core.subscriptions.hard_limit_percent           IS 'Seuil alerte dure / blocage (defaut 100%).';
COMMENT ON COLUMN core.subscriptions.recharge_enabled             IS 'Le client peut-il recharger son budget IA depuis l''UI ?';
COMMENT ON COLUMN core.subscriptions.business_plan_code           IS 'Code commercial (solo|equipe|service|...). Affiché en UI client.';
COMMENT ON COLUMN core.subscriptions.business_plan_label          IS 'Label affiché côté client (ex: "Équipe", "Solo").';

-- -----------------------------------------------------------------------------
-- 2. Schéma billing + table ai_recharges
-- -----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS billing AUTHORIZATION mybotia;

CREATE TABLE IF NOT EXISTS billing.ai_recharges (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid          NULL REFERENCES core.tenant(id) ON DELETE SET NULL,
  tenant_slug       text          NOT NULL,
  agent_slug        text          NULL,
  amount_ht         numeric(12,2) NOT NULL CHECK (amount_ht >= 0),
  amount_ttc        numeric(12,2) NULL    CHECK (amount_ttc IS NULL OR amount_ttc >= 0),
  currency          text          NOT NULL DEFAULT 'EUR',
  payment_status    text          NOT NULL DEFAULT 'pending',
  payment_provider  text          NULL,
  payment_reference text          NULL,
  valid_from        timestamptz   NOT NULL DEFAULT now(),
  valid_until       timestamptz   NULL,
  metadata          jsonb         NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_recharges_tenant_slug    ON billing.ai_recharges(tenant_slug);
CREATE INDEX IF NOT EXISTS idx_ai_recharges_agent_slug     ON billing.ai_recharges(agent_slug);
CREATE INDEX IF NOT EXISTS idx_ai_recharges_payment_status ON billing.ai_recharges(payment_status);
CREATE INDEX IF NOT EXISTS idx_ai_recharges_valid_from     ON billing.ai_recharges(valid_from DESC);
CREATE INDEX IF NOT EXISTS idx_ai_recharges_tenant_id      ON billing.ai_recharges(tenant_id);

-- Trigger updated_at (réutilise core.touch_updated_at)
DROP TRIGGER IF EXISTS trg_ai_recharges_touch ON billing.ai_recharges;
CREATE TRIGGER trg_ai_recharges_touch
  BEFORE UPDATE ON billing.ai_recharges
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

COMMENT ON TABLE  billing.ai_recharges                IS 'Recharges manuelles ou Stripe du budget IA (UB-2 sans Stripe — UB-8).';
COMMENT ON COLUMN billing.ai_recharges.payment_status IS 'pending|paid|failed|cancelled|refunded — validation app-side.';
COMMENT ON COLUMN billing.ai_recharges.metadata       IS 'Stripe session id, raw payload, override admin, etc.';

-- -----------------------------------------------------------------------------
-- 3. Étendre core.token_usage avec colonnes NULLABLE
-- -----------------------------------------------------------------------------
ALTER TABLE core.token_usage
  ADD COLUMN IF NOT EXISTS user_id               text,
  ADD COLUMN IF NOT EXISTS session_id            text,
  ADD COLUMN IF NOT EXISTS channel               text,
  ADD COLUMN IF NOT EXISTS establishment_id      text,
  ADD COLUMN IF NOT EXISTS module_key            text,
  ADD COLUMN IF NOT EXISTS service_tier          text,
  ADD COLUMN IF NOT EXISTS client_cost_estimated numeric(12,6);

ALTER TABLE core.token_usage
  DROP CONSTRAINT IF EXISTS token_usage_client_cost_check;
ALTER TABLE core.token_usage
  ADD  CONSTRAINT token_usage_client_cost_check
       CHECK (client_cost_estimated IS NULL OR client_cost_estimated >= 0);

CREATE INDEX IF NOT EXISTS idx_token_usage_service_tier ON core.token_usage(service_tier);
CREATE INDEX IF NOT EXISTS idx_token_usage_channel      ON core.token_usage(channel);
CREATE INDEX IF NOT EXISTS idx_token_usage_etab         ON core.token_usage(establishment_id);

COMMENT ON COLUMN core.token_usage.user_id               IS 'Utilisateur applicatif (texte libre, sera typé si user table stable).';
COMMENT ON COLUMN core.token_usage.session_id            IS 'Identifiant session/conversation/JID — utile drill-down.';
COMMENT ON COLUMN core.token_usage.channel               IS 'web|whatsapp|voice|email|api|cron|...';
COMMENT ON COLUMN core.token_usage.establishment_id      IS 'Cas IGH: identifiant établissement (1..20).';
COMMENT ON COLUMN core.token_usage.module_key            IS 'kpi|projects|crm|conversations|... (UI module dans lequel l''appel est issu).';
COMMENT ON COLUMN core.token_usage.service_tier          IS 'standard|premium|background|system — label business affiché côté client.';
COMMENT ON COLUMN core.token_usage.client_cost_estimated IS 'Coût client en EUR = api_cost × markup (rempli par bridge plus tard).';

-- -----------------------------------------------------------------------------
-- 4. Vue agrégée mensuelle billing.ai_usage_monthly_summary
--    Fallback markup : 1.20 (jointure subscriptions remise à UB-3).
-- -----------------------------------------------------------------------------
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
      COALESCE(tu.estimated_cost, 0) * 1.20
    )
  )                                                                 AS client_cost_estimated,
  SUM(tu.request_count)                                             AS request_count
FROM core.token_usage tu
LEFT JOIN core.tenant t ON t.id = tu.tenant_id
GROUP BY tu.tenant_id, t.slug, tu.agent_slug,
         date_trunc('month', tu.usage_date), tu.service_tier;

COMMENT ON VIEW billing.ai_usage_monthly_summary
  IS 'UB-2 — agrégat mensuel par tenant/agent/service_tier. Markup fallback 1.20 (jointure subscriptions différée à UB-3).';

COMMIT;
