-- ===================================================================
-- Bloc 7J — Audit log devis VL Medical (vlm_quote_events)
-- Date : 2026-05-04
-- ===================================================================
--
-- Objectif :
--   Historiser les actions importantes sur les devis VLM pour traçabilité.
--   Écrit en best-effort par le code applicatif côté API ; ne casse jamais
--   une mutation principale en cas d'échec d'INSERT log.
--
-- Pré-requis :
--   - core.vlm_quotes existe (migration 7H)
--   - core.assert_same_tenant_fk existe (migration 7F)
--
-- Idempotent : CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS +
-- DROP TRIGGER IF EXISTS / CREATE TRIGGER.
--
-- Types d'événements supportés :
--   quote_created, quote_created_from_deal, quote_updated,
--   quote_status_changed, line_added, line_updated, line_deleted,
--   pdf_downloaded, quote_cancelled

BEGIN;

CREATE TABLE IF NOT EXISTS core.vlm_quote_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES core.tenant(id) ON DELETE CASCADE,
  quote_id      uuid NOT NULL REFERENCES core.vlm_quotes(id) ON DELETE CASCADE,
  actor_email   text NULL,
  event_type    text NOT NULL,
  before_jsonb  jsonb NULL,
  after_jsonb   jsonb NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vlm_quote_events_type_valid CHECK (
    event_type IN (
      'quote_created',
      'quote_created_from_deal',
      'quote_updated',
      'quote_status_changed',
      'line_added',
      'line_updated',
      'line_deleted',
      'pdf_downloaded',
      'quote_cancelled'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_vlm_quote_events_tenant     ON core.vlm_quote_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vlm_quote_events_quote      ON core.vlm_quote_events(quote_id);
CREATE INDEX IF NOT EXISTS idx_vlm_quote_events_event_type ON core.vlm_quote_events(event_type);
CREATE INDEX IF NOT EXISTS idx_vlm_quote_events_created    ON core.vlm_quote_events(created_at DESC);

DROP TRIGGER IF EXISTS trg_vlm_quote_events_quote_same_tenant ON core.vlm_quote_events;
CREATE TRIGGER trg_vlm_quote_events_quote_same_tenant
  BEFORE INSERT OR UPDATE OF quote_id, tenant_id ON core.vlm_quote_events
  FOR EACH ROW EXECUTE FUNCTION core.assert_same_tenant_fk(
    'quote_id', 'core.vlm_quotes', 'id', 'tenant_id'
  );

COMMIT;
