-- ===================================================================
-- Bloc 7H — Devis VL Medical (vlm_quotes / vlm_quote_lines)
-- Date : 2026-05-04
-- ===================================================================
--
-- Objectif :
--   Créer le socle Devis VL Medical : table devis + table lignes +
--   triggers cohérence tenant (réutilisent core.assert_same_tenant_fk()
--   du 7F) + triggers calcul auto des totaux.
--
-- Doctrine :
--   - Pas de facturation dans ce bloc (Dolibarr reste source officielle).
--   - Numérotation MyBotIA indépendante : VQ{YY}{MM}-{seq3}.
--   - Migration additive uniquement, idempotent.
--
-- Pré-requis :
--   - core.assert_same_tenant_fk() existe (migration 7F).

BEGIN;

-- ===================================================================
-- 1. core.vlm_quotes
-- ===================================================================
CREATE TABLE IF NOT EXISTS core.vlm_quotes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES core.tenant(id) ON DELETE CASCADE,
  deal_id         uuid NULL REFERENCES core.vlm_container_deals(id) ON DELETE SET NULL,
  ref             text NOT NULL,
  client_name     text NOT NULL,
  client_email    text NULL,
  client_address  text NULL,
  title           text NOT NULL,
  status          text NOT NULL DEFAULT 'draft',
  currency        text NOT NULL DEFAULT 'EUR',
  valid_until     date NULL,
  notes           text NULL,
  terms           text NULL,
  total_ht        numeric(12,2) NOT NULL DEFAULT 0,
  total_vat       numeric(12,2) NOT NULL DEFAULT 0,
  total_ttc       numeric(12,2) NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vlm_quotes_status_valid CHECK (
    status IN ('draft','sent','accepted','refused','cancelled')
  ),
  CONSTRAINT vlm_quotes_total_ht_nonneg  CHECK (total_ht  >= 0),
  CONSTRAINT vlm_quotes_total_vat_nonneg CHECK (total_vat >= 0),
  CONSTRAINT vlm_quotes_total_ttc_nonneg CHECK (total_ttc >= 0),
  CONSTRAINT vlm_quotes_tenant_ref_unique UNIQUE (tenant_id, ref)
);

CREATE INDEX IF NOT EXISTS idx_vlm_quotes_tenant   ON core.vlm_quotes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vlm_quotes_deal     ON core.vlm_quotes(deal_id);
CREATE INDEX IF NOT EXISTS idx_vlm_quotes_status   ON core.vlm_quotes(status);
CREATE INDEX IF NOT EXISTS idx_vlm_quotes_created  ON core.vlm_quotes(created_at DESC);

-- ===================================================================
-- 2. core.vlm_quote_lines
-- ===================================================================
CREATE TABLE IF NOT EXISTS core.vlm_quote_lines (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES core.tenant(id) ON DELETE CASCADE,
  quote_id         uuid NOT NULL REFERENCES core.vlm_quotes(id) ON DELETE CASCADE,
  catalog_item_id  uuid NULL REFERENCES core.catalog_items(id) ON DELETE SET NULL,
  label            text NOT NULL,
  description      text NULL,
  quantity         numeric(12,2) NOT NULL DEFAULT 1,
  unit             text NULL,
  unit_price_ht    numeric(12,2) NOT NULL DEFAULT 0,
  vat_rate         numeric(5,2)  NOT NULL DEFAULT 20,
  line_total_ht    numeric(12,2) NOT NULL DEFAULT 0,
  line_total_vat   numeric(12,2) NOT NULL DEFAULT 0,
  line_total_ttc   numeric(12,2) NOT NULL DEFAULT 0,
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vlm_quote_lines_qty_nonneg        CHECK (quantity      >= 0),
  CONSTRAINT vlm_quote_lines_unit_price_nonneg CHECK (unit_price_ht >= 0),
  CONSTRAINT vlm_quote_lines_vat_rate_nonneg   CHECK (vat_rate      >= 0),
  CONSTRAINT vlm_quote_lines_total_ht_nonneg   CHECK (line_total_ht >= 0),
  CONSTRAINT vlm_quote_lines_total_vat_nonneg  CHECK (line_total_vat >= 0),
  CONSTRAINT vlm_quote_lines_total_ttc_nonneg  CHECK (line_total_ttc >= 0)
);

CREATE INDEX IF NOT EXISTS idx_vlm_quote_lines_tenant   ON core.vlm_quote_lines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vlm_quote_lines_quote    ON core.vlm_quote_lines(quote_id);
CREATE INDEX IF NOT EXISTS idx_vlm_quote_lines_catalog  ON core.vlm_quote_lines(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_vlm_quote_lines_sort     ON core.vlm_quote_lines(quote_id, sort_order);

-- ===================================================================
-- 3. Triggers cohérence tenant cross-table (utilisent fonction 7F)
-- ===================================================================
DROP TRIGGER IF EXISTS trg_vlm_quotes_deal_same_tenant ON core.vlm_quotes;
CREATE TRIGGER trg_vlm_quotes_deal_same_tenant
  BEFORE INSERT OR UPDATE OF deal_id, tenant_id ON core.vlm_quotes
  FOR EACH ROW EXECUTE FUNCTION core.assert_same_tenant_fk(
    'deal_id', 'core.vlm_container_deals', 'id', 'tenant_id'
  );

DROP TRIGGER IF EXISTS trg_vlm_quote_lines_quote_same_tenant ON core.vlm_quote_lines;
CREATE TRIGGER trg_vlm_quote_lines_quote_same_tenant
  BEFORE INSERT OR UPDATE OF quote_id, tenant_id ON core.vlm_quote_lines
  FOR EACH ROW EXECUTE FUNCTION core.assert_same_tenant_fk(
    'quote_id', 'core.vlm_quotes', 'id', 'tenant_id'
  );

DROP TRIGGER IF EXISTS trg_vlm_quote_lines_catalog_same_tenant ON core.vlm_quote_lines;
CREATE TRIGGER trg_vlm_quote_lines_catalog_same_tenant
  BEFORE INSERT OR UPDATE OF catalog_item_id, tenant_id ON core.vlm_quote_lines
  FOR EACH ROW EXECUTE FUNCTION core.assert_same_tenant_fk(
    'catalog_item_id', 'core.catalog_items', 'id', 'tenant_id'
  );

-- ===================================================================
-- 4. Trigger BEFORE INSERT/UPDATE : auto-compute line totals
-- ===================================================================
CREATE OR REPLACE FUNCTION core.compute_vlm_quote_line_totals()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  NEW.line_total_ht  := round(NEW.quantity * NEW.unit_price_ht, 2);
  NEW.line_total_vat := round(NEW.line_total_ht * NEW.vat_rate / 100, 2);
  NEW.line_total_ttc := round(NEW.line_total_ht + NEW.line_total_vat, 2);
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_vlm_quote_lines_compute_totals ON core.vlm_quote_lines;
CREATE TRIGGER trg_vlm_quote_lines_compute_totals
  BEFORE INSERT OR UPDATE OF quantity, unit_price_ht, vat_rate ON core.vlm_quote_lines
  FOR EACH ROW EXECUTE FUNCTION core.compute_vlm_quote_line_totals();

-- ===================================================================
-- 5. Trigger AFTER INSERT/UPDATE/DELETE : recalcul totaux quote parent
-- ===================================================================
CREATE OR REPLACE FUNCTION core.recalc_vlm_quote_totals()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  q_id uuid := COALESCE(NEW.quote_id, OLD.quote_id);
BEGIN
  UPDATE core.vlm_quotes
     SET total_ht  = COALESCE((SELECT SUM(line_total_ht)  FROM core.vlm_quote_lines WHERE quote_id = q_id), 0),
         total_vat = COALESCE((SELECT SUM(line_total_vat) FROM core.vlm_quote_lines WHERE quote_id = q_id), 0),
         total_ttc = COALESCE((SELECT SUM(line_total_ttc) FROM core.vlm_quote_lines WHERE quote_id = q_id), 0),
         updated_at = now()
   WHERE id = q_id;
  RETURN COALESCE(NEW, OLD);
END;
$fn$;

DROP TRIGGER IF EXISTS trg_vlm_quote_lines_recalc_totals ON core.vlm_quote_lines;
CREATE TRIGGER trg_vlm_quote_lines_recalc_totals
  AFTER INSERT OR UPDATE OR DELETE ON core.vlm_quote_lines
  FOR EACH ROW EXECUTE FUNCTION core.recalc_vlm_quote_totals();

COMMIT;
