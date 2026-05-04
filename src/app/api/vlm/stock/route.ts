// Bloc 7E — VLM stock médical : liste stock_items + extension VLM jointe.

import { adminQuery } from "@/lib/admin-db";
import { requireVlmAccess, VLM_SLUG } from "@/lib/vlm-access";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

interface Row {
  id: string;
  label: string;
  sku: string | null;
  warehouse: string | null;
  location: string | null;
  quantity: string;
  min_quantity: string;
  unit: string | null;
  status: string;
  lot_number: string | null;
  expiry_date: string | null;
  medical_category: string | null;
  conditioning: string | null;
  sterile: boolean | null;
  ce_marking: string | null;
  supplier_name: string | null;
  origin_country: string | null;
}

export async function GET() {
  const auth = await requireVlmAccess();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  try {
    const rows = await adminQuery<Row>(
      `SELECT
         s.id, s.label, s.sku, s.warehouse, s.location,
         s.quantity, s.min_quantity, s.unit, s.status,
         e.lot_number,
         to_char(e.expiry_date, 'YYYY-MM-DD') AS expiry_date,
         e.medical_category, e.conditioning, e.sterile, e.ce_marking,
         e.supplier_name, e.origin_country
       FROM core.stock_items s
       JOIN core.tenant t ON t.id = s.tenant_id
       LEFT JOIN core.vlm_stock_extra e ON e.stock_item_id = s.id AND e.tenant_id = s.tenant_id
       WHERE t.slug = $1
       ORDER BY
         CASE WHEN e.expiry_date IS NULL THEN 1 ELSE 0 END,
         e.expiry_date ASC NULLS LAST,
         s.label`,
      [VLM_SLUG]
    );
    return Response.json(
      {
        items: rows.map((r) => ({
          id: r.id,
          label: r.label,
          sku: r.sku,
          warehouse: r.warehouse,
          location: r.location,
          quantity: parseFloat(r.quantity) || 0,
          minQuantity: parseFloat(r.min_quantity) || 0,
          unit: r.unit,
          status: r.status,
          lotNumber: r.lot_number,
          expiryDate: r.expiry_date,
          medicalCategory: r.medical_category,
          conditioning: r.conditioning,
          sterile: r.sterile,
          ceMarking: r.ce_marking,
          supplierName: r.supplier_name,
          originCountry: r.origin_country,
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
