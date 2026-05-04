// Bloc 7D — VLM regulatory : GET liste + POST création.

import { adminQuery } from "@/lib/admin-db";
import { requireSuperadmin } from "@/lib/admin-auth";
import {
  VLM_DEVICE_CLASSES,
  VLM_REGULATORY_STATUSES,
  type VlmDeviceClass,
  type VlmRegulatory,
  type VlmRegulatoryStatus,
} from "@/lib/vlm-types";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;
const VLM_SLUG = "vlmedical";

interface Row {
  id: string;
  tenant_id: string;
  tenant_slug: string;
  catalog_item_id: string | null;
  stock_item_id: string | null;
  ansm_file_number: string | null;
  ce_certificate_number: string | null;
  device_class: VlmDeviceClass | null;
  regulatory_status: VlmRegulatoryStatus;
  compliance_notes: string | null;
  document_url: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(r: Row): VlmRegulatory {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    tenantSlug: r.tenant_slug,
    catalogItemId: r.catalog_item_id,
    stockItemId: r.stock_item_id,
    ansmFileNumber: r.ansm_file_number,
    ceCertificateNumber: r.ce_certificate_number,
    deviceClass: r.device_class,
    regulatoryStatus: r.regulatory_status,
    complianceNotes: r.compliance_notes,
    documentUrl: r.document_url,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const SELECT_COLS = `r.id, r.tenant_id, t.slug AS tenant_slug,
  r.catalog_item_id, r.stock_item_id,
  r.ansm_file_number, r.ce_certificate_number, r.device_class,
  r.regulatory_status, r.compliance_notes, r.document_url,
  to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
  to_char(r.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at`;

export async function GET(request: Request) {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get("tenant") || VLM_SLUG;
  if (tenantSlug !== VLM_SLUG) {
    return Response.json({ error: "VLM custom vertical réservé au tenant vlmedical" }, { status: 400, headers: NO_STORE });
  }
  try {
    const rows = await adminQuery<Row>(
      `SELECT ${SELECT_COLS}
         FROM core.vlm_regulatory r
         JOIN core.tenant t ON t.id = r.tenant_id
        WHERE t.slug = $1
        ORDER BY r.regulatory_status, r.created_at DESC`,
      [tenantSlug]
    );
    return Response.json({ items: rows.map(mapRow) }, { headers: NO_STORE });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur DB" },
      { status: 502, headers: NO_STORE }
    );
  }
}

interface CreateBody {
  tenantSlug: string;
  catalogItemId?: string | null;
  stockItemId?: string | null;
  ansmFileNumber?: string | null;
  ceCertificateNumber?: string | null;
  deviceClass?: VlmDeviceClass | null;
  regulatoryStatus?: VlmRegulatoryStatus;
  complianceNotes?: string | null;
  documentUrl?: string | null;
}

function validateCreate(body: unknown): { ok: true; data: CreateBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "body invalide" };
  const b = body as Record<string, unknown>;
  if (typeof b.tenantSlug !== "string" || !b.tenantSlug)
    return { ok: false, error: "tenantSlug requis" };
  if (b.tenantSlug !== VLM_SLUG)
    return { ok: false, error: "VLM custom vertical réservé au tenant vlmedical" };
  let deviceClass: VlmDeviceClass | null = null;
  if (b.deviceClass !== undefined && b.deviceClass !== null && b.deviceClass !== "") {
    if (typeof b.deviceClass !== "string" || !VLM_DEVICE_CLASSES.includes(b.deviceClass as VlmDeviceClass))
      return { ok: false, error: `deviceClass invalide (allowed: ${VLM_DEVICE_CLASSES.join(", ")})` };
    deviceClass = b.deviceClass as VlmDeviceClass;
  }
  const regulatoryStatus = typeof b.regulatoryStatus === "string" ? b.regulatoryStatus : "to_configure";
  if (!VLM_REGULATORY_STATUSES.includes(regulatoryStatus as VlmRegulatoryStatus))
    return { ok: false, error: `regulatoryStatus invalide (allowed: ${VLM_REGULATORY_STATUSES.join(", ")})` };
  const catalogItemId =
    typeof b.catalogItemId === "string" && /^[0-9a-f-]{36}$/i.test(b.catalogItemId) ? b.catalogItemId : null;
  const stockItemId =
    typeof b.stockItemId === "string" && /^[0-9a-f-]{36}$/i.test(b.stockItemId) ? b.stockItemId : null;
  return {
    ok: true,
    data: {
      tenantSlug: VLM_SLUG,
      catalogItemId,
      stockItemId,
      ansmFileNumber: typeof b.ansmFileNumber === "string" && b.ansmFileNumber.trim() ? b.ansmFileNumber.trim() : null,
      ceCertificateNumber: typeof b.ceCertificateNumber === "string" && b.ceCertificateNumber.trim() ? b.ceCertificateNumber.trim() : null,
      deviceClass,
      regulatoryStatus: regulatoryStatus as VlmRegulatoryStatus,
      complianceNotes: typeof b.complianceNotes === "string" ? b.complianceNotes : null,
      documentUrl: typeof b.documentUrl === "string" && b.documentUrl.trim() ? b.documentUrl.trim() : null,
    },
  };
}

export async function POST(request: Request) {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body json invalide" }, { status: 400, headers: NO_STORE });
  }
  const v = validateCreate(body);
  if (!v.ok) return Response.json({ error: v.error }, { status: 400, headers: NO_STORE });
  const d = v.data;

  try {
    const tenantRows = await adminQuery<{ id: string }>(
      "SELECT id FROM core.tenant WHERE slug = $1",
      [VLM_SLUG]
    );
    if (!tenantRows[0]) {
      return Response.json({ error: "tenant vlmedical introuvable" }, { status: 404, headers: NO_STORE });
    }
    const tenantId = tenantRows[0].id;

    if (d.catalogItemId) {
      const catCheck = await adminQuery<{ id: string }>(
        "SELECT id FROM core.catalog_items WHERE id = $1 AND tenant_id = $2",
        [d.catalogItemId, tenantId]
      );
      if (!catCheck[0]) {
        return Response.json({ error: "catalogItemId hors tenant vlmedical" }, { status: 400, headers: NO_STORE });
      }
    }
    if (d.stockItemId) {
      const stockCheck = await adminQuery<{ id: string }>(
        "SELECT id FROM core.stock_items WHERE id = $1 AND tenant_id = $2",
        [d.stockItemId, tenantId]
      );
      if (!stockCheck[0]) {
        return Response.json({ error: "stockItemId hors tenant vlmedical" }, { status: 400, headers: NO_STORE });
      }
    }

    const inserted = await adminQuery<{ r_id: string }>(
      `INSERT INTO core.vlm_regulatory
         (tenant_id, catalog_item_id, stock_item_id, ansm_file_number,
          ce_certificate_number, device_class, regulatory_status,
          compliance_notes, document_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id AS r_id`,
      [
        tenantId,
        d.catalogItemId,
        d.stockItemId,
        d.ansmFileNumber,
        d.ceCertificateNumber,
        d.deviceClass,
        d.regulatoryStatus,
        d.complianceNotes,
        d.documentUrl,
      ]
    );
    const newId = inserted[0].r_id;
    const rows = await adminQuery<Row>(
      `SELECT ${SELECT_COLS}
         FROM core.vlm_regulatory r
         JOIN core.tenant t ON t.id = r.tenant_id
        WHERE r.id = $1`,
      [newId]
    );
    return Response.json({ item: mapRow(rows[0]) }, { status: 201, headers: NO_STORE });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur DB" },
      { status: 502, headers: NO_STORE }
    );
  }
}
