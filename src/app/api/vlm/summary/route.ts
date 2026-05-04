// Bloc 7E — VLM dashboard summary : KPIs + alertes péremption + dossiers à configurer.
// Lecture seule. Accès : superadmin OR session.tenantSlug === 'vlmedical'.

import { adminQuery } from "@/lib/admin-db";
import { requireVlmAccess, VLM_SLUG } from "@/lib/vlm-access";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;
const EXPIRY_ALERT_DAYS = 90;

interface DealRow {
  count: string;
  total_purchase: string | null;
  total_transport: string | null;
  total_customs: string | null;
  total_insurance: string | null;
  total_conditioning: string | null;
  total_other: string | null;
  total_sale: string | null;
  active_count: string;
}

interface CountRow { count: string }

function num(v: string | null): number {
  return v === null ? 0 : parseFloat(v) || 0;
}

export async function GET() {
  const auth = await requireVlmAccess();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }

  try {
    // Tenant ID
    const tenantRows = await adminQuery<{ id: string }>(
      "SELECT id FROM core.tenant WHERE slug = $1",
      [VLM_SLUG]
    );
    if (!tenantRows[0]) {
      return Response.json({ error: "tenant vlmedical introuvable" }, { status: 404, headers: NO_STORE });
    }
    const tenantId = tenantRows[0].id;

    // Container deals : agrégats financiers
    const dealAgg = await adminQuery<DealRow>(
      `SELECT
         COUNT(*)::text AS count,
         SUM(purchase_amount)::text   AS total_purchase,
         SUM(transport_cost)::text    AS total_transport,
         SUM(customs_cost)::text      AS total_customs,
         SUM(insurance_cost)::text    AS total_insurance,
         SUM(conditioning_cost)::text AS total_conditioning,
         SUM(other_cost)::text        AS total_other,
         SUM(sale_amount)::text       AS total_sale,
         COUNT(*) FILTER (WHERE status NOT IN ('delivered','billed','cancelled'))::text AS active_count
       FROM core.vlm_container_deals
       WHERE tenant_id = $1`,
      [tenantId]
    );
    const da = dealAgg[0];
    const totalCost =
      num(da.total_purchase) + num(da.total_transport) + num(da.total_customs) +
      num(da.total_insurance) + num(da.total_conditioning) + num(da.total_other);
    const totalSale = num(da.total_sale);
    const grossMargin = totalSale - totalCost;
    const marginRate = totalSale > 0 ? grossMargin / totalSale : null;

    // Stock médical
    const stockExtra = await adminQuery<CountRow>(
      "SELECT COUNT(*)::text AS count FROM core.vlm_stock_extra WHERE tenant_id = $1",
      [tenantId]
    );

    // Stock items VLM (quantité totale, sous seuil)
    const stockAgg = await adminQuery<{
      count: string;
      low_stock: string;
    }>(
      `SELECT
         COUNT(*)::text AS count,
         COUNT(*) FILTER (WHERE quantity <= min_quantity AND min_quantity > 0 AND status='active')::text AS low_stock
       FROM core.stock_items WHERE tenant_id = $1`,
      [tenantId]
    );

    // Alertes péremption : items avec expiry_date dans EXPIRY_ALERT_DAYS jours
    const expiryAlerts = await adminQuery<{
      stock_item_id: string;
      label: string;
      lot_number: string | null;
      expiry_date: string;
      days_left: string;
    }>(
      `SELECT e.stock_item_id, s.label, e.lot_number,
              to_char(e.expiry_date, 'YYYY-MM-DD') AS expiry_date,
              (e.expiry_date - CURRENT_DATE)::text AS days_left
         FROM core.vlm_stock_extra e
         JOIN core.stock_items s ON s.id = e.stock_item_id
        WHERE e.tenant_id = $1
          AND e.expiry_date IS NOT NULL
          AND e.expiry_date <= CURRENT_DATE + ($2 || ' days')::interval
        ORDER BY e.expiry_date ASC
        LIMIT 20`,
      [tenantId, EXPIRY_ALERT_DAYS.toString()]
    );

    // Livraisons en transit
    const deliveriesAgg = await adminQuery<{
      count: string;
      in_transit: string;
      delivered: string;
    }>(
      `SELECT
         COUNT(*)::text AS count,
         COUNT(*) FILTER (WHERE status IN ('pending','preparing','in_transit'))::text AS in_transit,
         COUNT(*) FILTER (WHERE status = 'delivered')::text AS delivered
       FROM core.deliveries WHERE tenant_id = $1`,
      [tenantId]
    );

    // Regulatory : à configurer / expirés
    const regAgg = await adminQuery<{
      count: string;
      to_configure: string;
      expired: string;
      compliant: string;
    }>(
      `SELECT
         COUNT(*)::text AS count,
         COUNT(*) FILTER (WHERE regulatory_status = 'to_configure')::text AS to_configure,
         COUNT(*) FILTER (WHERE regulatory_status = 'expired')::text AS expired,
         COUNT(*) FILTER (WHERE regulatory_status = 'compliant')::text AS compliant
       FROM core.vlm_regulatory WHERE tenant_id = $1`,
      [tenantId]
    );
    const r = regAgg[0];

    return Response.json(
      {
        generatedAt: new Date().toISOString(),
        tenant: VLM_SLUG,
        deals: {
          count: parseInt(da.count, 10) || 0,
          activeCount: parseInt(da.active_count, 10) || 0,
          totalCost,
          totalSale,
          grossMargin,
          marginRate,
          currency: "EUR",
        },
        stock: {
          itemCount: parseInt(stockAgg[0].count, 10) || 0,
          lowStockCount: parseInt(stockAgg[0].low_stock, 10) || 0,
          extraCount: parseInt(stockExtra[0].count, 10) || 0,
        },
        deliveries: {
          count: parseInt(deliveriesAgg[0].count, 10) || 0,
          inTransit: parseInt(deliveriesAgg[0].in_transit, 10) || 0,
          delivered: parseInt(deliveriesAgg[0].delivered, 10) || 0,
        },
        regulatory: {
          count: parseInt(r.count, 10) || 0,
          toConfigure: parseInt(r.to_configure, 10) || 0,
          expired: parseInt(r.expired, 10) || 0,
          compliant: parseInt(r.compliant, 10) || 0,
        },
        expiryAlerts: expiryAlerts.map((a) => ({
          stockItemId: a.stock_item_id,
          label: a.label,
          lotNumber: a.lot_number,
          expiryDate: a.expiry_date,
          daysLeft: parseInt(a.days_left, 10),
        })),
      },
      { headers: NO_STORE }
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur DB" },
      { status: 502, headers: NO_STORE }
    );
  }
}
