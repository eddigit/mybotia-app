// Bloc 7G — Helper data Packing List VL Medical.
// Récupère deal + delivery liée + stock_items VLM associés (best-effort).
// Tenant strict : vlmedical uniquement (sécurité côté route + ici en garde-fou).

import { adminQuery } from "@/lib/admin-db";
import { VLM_SLUG } from "@/lib/vlm-access";

export interface PackingListData {
  deal: {
    id: string;
    ref: string | null;
    title: string;
    supplierName: string | null;
    originCountry: string | null;
    destinationCountry: string | null;
    containerType: string | null;
    status: string;
    createdAt: string;
  };
  delivery: {
    id: string;
    ref: string | null;
    title: string;
    carrier: string | null;
    trackingNumber: string | null;
    shipFrom: string | null;
    shipTo: string | null;
    expectedDate: string | null;
    status: string;
  } | null;
  stockItems: Array<{
    id: string;
    label: string;
    sku: string | null;
    quantity: number;
    unit: string | null;
    lotNumber: string | null;
    expiryDate: string | null;
    medicalCategory: string | null;
    ceMarking: string | null;
    sterile: boolean | null;
    supplierName: string | null;
    originCountry: string | null;
  }>;
  regulatory: Array<{
    deviceClass: string | null;
    regulatoryStatus: string;
    ansmFileNumber: string | null;
    ceCertificateNumber: string | null;
  }>;
  generatedAt: string;
}

export async function getPackingListData(dealId: string): Promise<PackingListData | null> {
  // Deal + check tenant
  const dealRows = await adminQuery<{
    id: string;
    ref: string | null;
    title: string;
    supplier_name: string | null;
    origin_country: string | null;
    destination_country: string | null;
    container_type: string | null;
    status: string;
    delivery_id: string | null;
    created_at: string;
  }>(
    `SELECT cd.id, cd.ref, cd.title,
            cd.supplier_name, cd.origin_country, cd.destination_country,
            cd.container_type, cd.status, cd.delivery_id,
            to_char(cd.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
       FROM core.vlm_container_deals cd
       JOIN core.tenant t ON t.id = cd.tenant_id
      WHERE cd.id = $1 AND t.slug = $2`,
    [dealId, VLM_SLUG]
  );
  const d = dealRows[0];
  if (!d) return null;

  // Delivery liée
  let delivery: PackingListData["delivery"] = null;
  if (d.delivery_id) {
    const dlvRows = await adminQuery<{
      id: string;
      ref: string | null;
      title: string;
      carrier: string | null;
      tracking_number: string | null;
      ship_from: string | null;
      ship_to: string | null;
      expected_date: string | null;
      status: string;
    }>(
      `SELECT id, ref, title, carrier, tracking_number, ship_from, ship_to,
              to_char(expected_date, 'YYYY-MM-DD') AS expected_date, status
         FROM core.deliveries WHERE id = $1`,
      [d.delivery_id]
    );
    if (dlvRows[0]) {
      const x = dlvRows[0];
      delivery = {
        id: x.id,
        ref: x.ref,
        title: x.title,
        carrier: x.carrier,
        trackingNumber: x.tracking_number,
        shipFrom: x.ship_from,
        shipTo: x.ship_to,
        expectedDate: x.expected_date,
        status: x.status,
      };
    }
  }

  // Stock items VLM (avec extension)
  // MVP : on remonte tous les stock_items VLM avec leur extension VLM, pas
  // de lien direct deal -> stock dans le schéma actuel. À raffiner si une
  // table de jonction est ajoutée plus tard.
  const stockRows = await adminQuery<{
    id: string;
    label: string;
    sku: string | null;
    quantity: string;
    unit: string | null;
    lot_number: string | null;
    expiry_date: string | null;
    medical_category: string | null;
    ce_marking: string | null;
    sterile: boolean | null;
    supplier_name: string | null;
    origin_country: string | null;
  }>(
    `SELECT s.id, s.label, s.sku, s.quantity, s.unit,
            e.lot_number,
            to_char(e.expiry_date, 'YYYY-MM-DD') AS expiry_date,
            e.medical_category, e.ce_marking, e.sterile,
            e.supplier_name, e.origin_country
       FROM core.stock_items s
       LEFT JOIN core.vlm_stock_extra e ON e.stock_item_id = s.id AND e.tenant_id = s.tenant_id
       JOIN core.tenant t ON t.id = s.tenant_id
      WHERE t.slug = $1 AND s.status = 'active'
      ORDER BY s.label
      LIMIT 50`,
    [VLM_SLUG]
  );
  const stockItems = stockRows.map((r) => ({
    id: r.id,
    label: r.label,
    sku: r.sku,
    quantity: parseFloat(r.quantity) || 0,
    unit: r.unit,
    lotNumber: r.lot_number,
    expiryDate: r.expiry_date,
    medicalCategory: r.medical_category,
    ceMarking: r.ce_marking,
    sterile: r.sterile,
    supplierName: r.supplier_name,
    originCountry: r.origin_country,
  }));

  // Regulatory : tous les dossiers conformes du tenant (vue simple)
  const regRows = await adminQuery<{
    device_class: string | null;
    regulatory_status: string;
    ansm_file_number: string | null;
    ce_certificate_number: string | null;
  }>(
    `SELECT r.device_class, r.regulatory_status,
            r.ansm_file_number, r.ce_certificate_number
       FROM core.vlm_regulatory r
       JOIN core.tenant t ON t.id = r.tenant_id
      WHERE t.slug = $1
      ORDER BY r.regulatory_status, r.created_at DESC
      LIMIT 20`,
    [VLM_SLUG]
  );
  const regulatory = regRows.map((r) => ({
    deviceClass: r.device_class,
    regulatoryStatus: r.regulatory_status,
    ansmFileNumber: r.ansm_file_number,
    ceCertificateNumber: r.ce_certificate_number,
  }));

  return {
    deal: {
      id: d.id,
      ref: d.ref,
      title: d.title,
      supplierName: d.supplier_name,
      originCountry: d.origin_country,
      destinationCountry: d.destination_country,
      containerType: d.container_type,
      status: d.status,
      createdAt: d.created_at,
    },
    delivery,
    stockItems,
    regulatory,
    generatedAt: new Date().toISOString(),
  };
}
