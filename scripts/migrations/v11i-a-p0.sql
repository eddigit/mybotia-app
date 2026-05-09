-- Migration v1.1.i-a Phase 2B DDL idempotente P0
-- Tenant cible : mybotia (583bc4d2-48d0-4089-a365-ccc18de00d83)
-- Schema cible : mybotia_business dans mybotia_core
-- Date : 2026-05-09
-- Idempotente : IF NOT EXISTS partout — re-execution = no-op
-- Aucun DROP

-- =============================================================
-- 1. Champs clients
-- =============================================================
ALTER TABLE mybotia_business.clients ADD COLUMN IF NOT EXISTS ton text;
ALTER TABLE mybotia_business.clients ADD COLUMN IF NOT EXISTS town text;
ALTER TABLE mybotia_business.clients ADD COLUMN IF NOT EXISTS country_code text;
ALTER TABLE mybotia_business.clients ADD COLUMN IF NOT EXISTS lea_slug text;
ALTER TABLE mybotia_business.clients ADD COLUMN IF NOT EXISTS dolibarr_societe_id integer;

-- Index pour dedup et recherche rapide
CREATE UNIQUE INDEX IF NOT EXISTS clients_tenant_lea_slug_uq ON mybotia_business.clients (tenant_id, lea_slug) WHERE lea_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS clients_dolibarr_id_idx ON mybotia_business.clients (dolibarr_societe_id) WHERE dolibarr_societe_id IS NOT NULL;

-- =============================================================
-- 2. Champs contacts
-- =============================================================
ALTER TABLE mybotia_business.contacts ADD COLUMN IF NOT EXISTS whatsapp_jid text;
ALTER TABLE mybotia_business.contacts ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS contacts_whatsapp_jid_idx ON mybotia_business.contacts (whatsapp_jid) WHERE whatsapp_jid IS NOT NULL;

-- =============================================================
-- 3. Champs tracabilite Dolibarr (P0 pour preparer P1)
-- =============================================================
ALTER TABLE mybotia_business.invoices ADD COLUMN IF NOT EXISTS dolibarr_ref text;
ALTER TABLE mybotia_business.quotes ADD COLUMN IF NOT EXISTS dolibarr_ref text;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_dolibarr_ref_uq ON mybotia_business.invoices (tenant_id, dolibarr_ref) WHERE dolibarr_ref IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS quotes_dolibarr_ref_uq ON mybotia_business.quotes (tenant_id, dolibarr_ref) WHERE dolibarr_ref IS NOT NULL;

-- =============================================================
-- 4. Table client_jids (multi-JID par client)
-- =============================================================
CREATE TABLE IF NOT EXISTS mybotia_business.client_jids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES mybotia_business.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES mybotia_business.clients(id) ON DELETE CASCADE,
  jid text NOT NULL,
  group_name text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_jids_unique UNIQUE (tenant_id, client_id, jid)
);
CREATE INDEX IF NOT EXISTS client_jids_jid_idx ON mybotia_business.client_jids (jid);
CREATE INDEX IF NOT EXISTS client_jids_client_id_idx ON mybotia_business.client_jids (client_id);

-- =============================================================
-- 5. Table client_activities (notes + log)
-- =============================================================
CREATE TABLE IF NOT EXISTS mybotia_business.client_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES mybotia_business.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES mybotia_business.clients(id) ON DELETE CASCADE,
  project_id uuid REFERENCES mybotia_business.projects(id) ON DELETE SET NULL,
  activity_type text NOT NULL CHECK (activity_type IN ('note','call','email','whatsapp','meeting','relance','payment','log_import','status_change','other')),
  title text NOT NULL,
  content text,
  activity_date timestamptz NOT NULL DEFAULT now(),
  author text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','dolibarr_actioncomm','workspace_lea_historique','bridge_conversation','system','import_p0')),
  source_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_activities_client_date_idx ON mybotia_business.client_activities (client_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS client_activities_type_idx ON mybotia_business.client_activities (activity_type);
CREATE INDEX IF NOT EXISTS client_activities_source_ref_idx ON mybotia_business.client_activities (source, source_ref) WHERE source_ref IS NOT NULL;

-- =============================================================
-- 6. RLS sur les 2 nouvelles tables (pattern tenant_isolation)
-- =============================================================
ALTER TABLE mybotia_business.client_jids ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'mybotia_business'
      AND tablename  = 'client_jids'
      AND policyname = 'tenant_isolation'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY tenant_isolation ON mybotia_business.client_jids
        FOR ALL TO PUBLIC
        USING (tenant_id = (current_setting('app.tenant_id', true))::uuid)
        WITH CHECK (tenant_id = (current_setting('app.tenant_id', true))::uuid)
    $policy$;
  END IF;
END
$$;

ALTER TABLE mybotia_business.client_activities ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'mybotia_business'
      AND tablename  = 'client_activities'
      AND policyname = 'tenant_isolation'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY tenant_isolation ON mybotia_business.client_activities
        FOR ALL TO PUBLIC
        USING (tenant_id = (current_setting('app.tenant_id', true))::uuid)
        WITH CHECK (tenant_id = (current_setting('app.tenant_id', true))::uuid)
    $policy$;
  END IF;
END
$$;

-- =============================================================
-- 7. audit_log INSERT — tracabilite de la migration
-- =============================================================
INSERT INTO mybotia_business.audit_logs (tenant_id, user_id, table_name, row_id, action, diff, created_at)
VALUES (
  '583bc4d2-48d0-4089-a365-ccc18de00d83',
  NULL,
  'mybotia_business.SCHEMA',
  gen_random_uuid()::text,
  'DDL_APPLY',
  '{"version":"v11i-a-p0","tables_added":["client_jids","client_activities"],"columns_added":{"clients":["ton","town","country_code","lea_slug","dolibarr_societe_id"],"contacts":["whatsapp_jid","is_primary"],"invoices":["dolibarr_ref"],"quotes":["dolibarr_ref"]}}'::jsonb,
  now()
);
