-- ===================================================================
-- LEA-WA-PROTOCOLS-MVP-ADMIN — Table protocoles WhatsApp par groupe/JID
-- Date : 2026-05-04 (initiale + ajustement same-day)
-- ===================================================================
-- Migration additive uniquement.
-- Modèle : category / response_mode / gilles_instruction_mode /
-- operational_scope / protocol_text.
-- Le runtime WhatsApp n'est PAS branché dans ce bloc (admin seulement).
--
-- Idempotente : peut être rejouée sans erreur sur un environnement déjà
-- migré. Utilise CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
-- et DROP/ADD CONSTRAINT pour les CHECK enums.

BEGIN;

-- ===================================================================
-- Table principale
-- ===================================================================
CREATE TABLE IF NOT EXISTS core.whatsapp_protocols (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jid                     text NOT NULL UNIQUE,
  group_name              text NOT NULL,
  tenant_slug             text NOT NULL,
  agent_slug              text NOT NULL DEFAULT 'lea',
  category                text NOT NULL DEFAULT 'support_client',
  response_mode           text NOT NULL DEFAULT 'draft_only',
  gilles_instruction_mode text NOT NULL DEFAULT 'draft_before_send',
  status                  text NOT NULL DEFAULT 'active',
  operational_scope       text NOT NULL DEFAULT '',
  protocol_text           text NOT NULL DEFAULT '',
  notes                   text NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Ajustement : si la table existait déjà sans operational_scope (cas du
-- déploiement initial avant ajustement), on ajoute la colonne.
ALTER TABLE core.whatsapp_protocols
  ADD COLUMN IF NOT EXISTS operational_scope text NOT NULL DEFAULT '';

-- ===================================================================
-- CHECK constraints (drop + recreate pour pouvoir étendre les enums)
-- ===================================================================
ALTER TABLE core.whatsapp_protocols
  DROP CONSTRAINT IF EXISTS wa_protocols_category_valid;
ALTER TABLE core.whatsapp_protocols
  ADD CONSTRAINT wa_protocols_category_valid CHECK (
    category IN (
      'support_client',
      'commercial_demo',
      'project_workgroup',
      'web_project_delivery',
      'payment_followup',
      'legal_workgroup',
      'sensitive_validation',
      'custom'
    )
  );

ALTER TABLE core.whatsapp_protocols
  DROP CONSTRAINT IF EXISTS wa_protocols_response_mode_valid;
ALTER TABLE core.whatsapp_protocols
  ADD CONSTRAINT wa_protocols_response_mode_valid CHECK (
    response_mode IN (
      'draft_only',
      'auto_safe',
      'operational_autonomous',
      'silent',
      'disabled'
    )
  );

ALTER TABLE core.whatsapp_protocols
  DROP CONSTRAINT IF EXISTS wa_protocols_gilles_mode_valid;
ALTER TABLE core.whatsapp_protocols
  ADD CONSTRAINT wa_protocols_gilles_mode_valid CHECK (
    gilles_instruction_mode IN (
      'draft_before_send',
      'send_if_explicit_go',
      'send_direct_if_gilles_writes_exact_message'
    )
  );

ALTER TABLE core.whatsapp_protocols
  DROP CONSTRAINT IF EXISTS wa_protocols_status_valid;
ALTER TABLE core.whatsapp_protocols
  ADD CONSTRAINT wa_protocols_status_valid CHECK (
    status IN ('active', 'disabled')
  );

-- ===================================================================
-- Indexes
-- ===================================================================
CREATE INDEX IF NOT EXISTS idx_wa_protocols_tenant   ON core.whatsapp_protocols(tenant_slug);
CREATE INDEX IF NOT EXISTS idx_wa_protocols_agent    ON core.whatsapp_protocols(agent_slug);
CREATE INDEX IF NOT EXISTS idx_wa_protocols_status   ON core.whatsapp_protocols(status);
CREATE INDEX IF NOT EXISTS idx_wa_protocols_category ON core.whatsapp_protocols(category);

COMMIT;
