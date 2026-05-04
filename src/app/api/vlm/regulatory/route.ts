// Bloc 7E — VLM regulatory : dossiers réglementaires médicaux.

import { adminQuery } from "@/lib/admin-db";
import { requireVlmAccess, VLM_SLUG } from "@/lib/vlm-access";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

interface Row {
  id: string;
  ansm_file_number: string | null;
  ce_certificate_number: string | null;
  device_class: string | null;
  regulatory_status: string;
  compliance_notes: string | null;
  document_url: string | null;
  catalog_item_id: string | null;
  catalog_name: string | null;
  stock_item_id: string | null;
  stock_label: string | null;
  created_at: string;
}

export async function GET() {
  const auth = await requireVlmAccess();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  try {
    const rows = await adminQuery<Row>(
      `SELECT r.id, r.ansm_file_number, r.ce_certificate_number, r.device_class,
              r.regulatory_status, r.compliance_notes, r.document_url,
              r.catalog_item_id, c.name AS catalog_name,
              r.stock_item_id, s.label AS stock_label,
              to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
         FROM core.vlm_regulatory r
         JOIN core.tenant t ON t.id = r.tenant_id
         LEFT JOIN core.catalog_items c ON c.id = r.catalog_item_id
         LEFT JOIN core.stock_items s ON s.id = r.stock_item_id
        WHERE t.slug = $1
        ORDER BY r.regulatory_status, r.created_at DESC`,
      [VLM_SLUG]
    );
    return Response.json(
      {
        items: rows.map((r) => ({
          id: r.id,
          ansmFileNumber: r.ansm_file_number,
          ceCertificateNumber: r.ce_certificate_number,
          deviceClass: r.device_class,
          regulatoryStatus: r.regulatory_status,
          complianceNotes: r.compliance_notes,
          documentUrl: r.document_url,
          catalogItemId: r.catalog_item_id,
          catalogName: r.catalog_name,
          stockItemId: r.stock_item_id,
          stockLabel: r.stock_label,
          createdAt: r.created_at,
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
