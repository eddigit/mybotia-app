-- ===================================================================
-- Bloc 7F — Durcissement DB : cohérence tenant cross-table
-- Date : 2026-05-04
-- ===================================================================
--
-- Objectif :
--   Empêcher au niveau DB qu'une ligne référence un parent appartenant
--   à un autre tenant via une FK. Ceinture-bretelles au-dessus des
--   gardes applicatives existantes côté API.
--
-- Doctrine :
--   API guard (1ère barrière) + DB trigger (2ème barrière) =
--   défense en profondeur multi-tenant.
--
-- Idempotent :
--   - CREATE OR REPLACE FUNCTION
--   - DROP TRIGGER IF EXISTS + CREATE TRIGGER
--   Peut être rejoué sans erreur sur un environnement déjà migré.
--
-- Audit pré-application recommandé :
--   SELECT count(*) FROM core.<child> c
--    JOIN core.<parent> p ON p.id = c.<fk>
--    WHERE c.<fk> IS NOT NULL AND p.tenant_id IS DISTINCT FROM c.tenant_id;
--   (doit retourner 0 sur les 6 relations avant CREATE TRIGGER)
--
-- Relations couvertes :
--   1. core.stock_items.catalog_item_id     -> core.catalog_items.id
--   2. core.transport_legs.delivery_id      -> core.deliveries.id
--   3. core.vlm_stock_extra.stock_item_id   -> core.stock_items.id
--   4. core.vlm_regulatory.catalog_item_id  -> core.catalog_items.id
--   5. core.vlm_regulatory.stock_item_id    -> core.stock_items.id
--   6. core.vlm_container_deals.delivery_id -> core.deliveries.id
--
-- Pour ajouter une nouvelle relation : un seul CREATE TRIGGER référençant
-- la même fonction core.assert_same_tenant_fk(...) avec les 4 args.

BEGIN;

-- ===================================================================
-- Fonction trigger générique paramétrable
-- ===================================================================
-- TG_ARGV :
--   [0] : nom de la colonne FK sur la table portant le trigger
--   [1] : table parente qualifiée schéma.table
--   [2] : nom de la colonne id du parent
--   [3] : nom de la colonne tenant du parent
--
-- Comportement :
--   - FK NULL                -> RETURN NEW (acceptée)
--   - parent absent          -> RETURN NEW (la FK existante lèvera son erreur)
--   - parent.tenant_id       -> NEW.tenant_id : RAISE EXCEPTION (ERRCODE check_violation)
--
-- ===================================================================

CREATE OR REPLACE FUNCTION core.assert_same_tenant_fk()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  fk_column            text := TG_ARGV[0];
  parent_table         text := TG_ARGV[1];
  parent_id_column     text := TG_ARGV[2];
  parent_tenant_column text := TG_ARGV[3];
  fk_value             uuid;
  parent_tenant        uuid;
BEGIN
  fk_value := NULLIF(to_jsonb(NEW)->>fk_column, '')::uuid;
  IF fk_value IS NULL THEN
    RETURN NEW;
  END IF;

  EXECUTE format(
    'SELECT %I FROM %s WHERE %I = $1',
    parent_tenant_column, parent_table, parent_id_column
  )
  INTO parent_tenant
  USING fk_value;

  IF parent_tenant IS NULL THEN
    RETURN NEW;
  END IF;

  IF parent_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION
      'cross_tenant_reference: %.% (FK column %) -> % : NEW.tenant_id=% but parent.tenant_id=% (parent_id=%)',
      TG_TABLE_SCHEMA, TG_TABLE_NAME, fk_column,
      parent_table,
      NEW.tenant_id, parent_tenant, fk_value
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$fn$;

-- ===================================================================
-- 6 triggers BEFORE INSERT OR UPDATE
-- ===================================================================

DROP TRIGGER IF EXISTS trg_stock_items_catalog_same_tenant ON core.stock_items;
CREATE TRIGGER trg_stock_items_catalog_same_tenant
  BEFORE INSERT OR UPDATE OF catalog_item_id, tenant_id ON core.stock_items
  FOR EACH ROW EXECUTE FUNCTION core.assert_same_tenant_fk(
    'catalog_item_id', 'core.catalog_items', 'id', 'tenant_id'
  );

DROP TRIGGER IF EXISTS trg_transport_legs_delivery_same_tenant ON core.transport_legs;
CREATE TRIGGER trg_transport_legs_delivery_same_tenant
  BEFORE INSERT OR UPDATE OF delivery_id, tenant_id ON core.transport_legs
  FOR EACH ROW EXECUTE FUNCTION core.assert_same_tenant_fk(
    'delivery_id', 'core.deliveries', 'id', 'tenant_id'
  );

DROP TRIGGER IF EXISTS trg_vlm_stock_extra_stock_same_tenant ON core.vlm_stock_extra;
CREATE TRIGGER trg_vlm_stock_extra_stock_same_tenant
  BEFORE INSERT OR UPDATE OF stock_item_id, tenant_id ON core.vlm_stock_extra
  FOR EACH ROW EXECUTE FUNCTION core.assert_same_tenant_fk(
    'stock_item_id', 'core.stock_items', 'id', 'tenant_id'
  );

DROP TRIGGER IF EXISTS trg_vlm_regulatory_catalog_same_tenant ON core.vlm_regulatory;
CREATE TRIGGER trg_vlm_regulatory_catalog_same_tenant
  BEFORE INSERT OR UPDATE OF catalog_item_id, tenant_id ON core.vlm_regulatory
  FOR EACH ROW EXECUTE FUNCTION core.assert_same_tenant_fk(
    'catalog_item_id', 'core.catalog_items', 'id', 'tenant_id'
  );

DROP TRIGGER IF EXISTS trg_vlm_regulatory_stock_same_tenant ON core.vlm_regulatory;
CREATE TRIGGER trg_vlm_regulatory_stock_same_tenant
  BEFORE INSERT OR UPDATE OF stock_item_id, tenant_id ON core.vlm_regulatory
  FOR EACH ROW EXECUTE FUNCTION core.assert_same_tenant_fk(
    'stock_item_id', 'core.stock_items', 'id', 'tenant_id'
  );

DROP TRIGGER IF EXISTS trg_vlm_container_deals_delivery_same_tenant ON core.vlm_container_deals;
CREATE TRIGGER trg_vlm_container_deals_delivery_same_tenant
  BEFORE INSERT OR UPDATE OF delivery_id, tenant_id ON core.vlm_container_deals
  FOR EACH ROW EXECUTE FUNCTION core.assert_same_tenant_fk(
    'delivery_id', 'core.deliveries', 'id', 'tenant_id'
  );

COMMIT;
