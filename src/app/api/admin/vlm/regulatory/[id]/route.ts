// Bloc 7D — PATCH VLM regulatory.

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

const FIELD_MAP: Record<string, string> = {
  ansmFileNumber: "ansm_file_number",
  ceCertificateNumber: "ce_certificate_number",
  deviceClass: "device_class",
  regulatoryStatus: "regulatory_status",
  complianceNotes: "compliance_notes",
  documentUrl: "document_url",
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  const { id } = await params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ error: "id invalide" }, { status: 400, headers: NO_STORE });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "body json invalide" }, { status: 400, headers: NO_STORE });
  }

  const sets: string[] = [];
  const args: unknown[] = [];
  function pushSet(col: string, val: unknown) {
    args.push(val);
    sets.push(`${col} = $${args.length}`);
  }

  for (const [k, dbCol] of Object.entries(FIELD_MAP)) {
    if (!(k in body)) continue;
    const v = body[k];
    if (v === undefined) continue;

    if (k === "deviceClass") {
      if (v === null || v === "") {
        sets.push(`${dbCol} = NULL`);
        continue;
      }
      if (typeof v !== "string" || !VLM_DEVICE_CLASSES.includes(v as VlmDeviceClass))
        return Response.json(
          { error: `deviceClass invalide (allowed: ${VLM_DEVICE_CLASSES.join(", ")})` },
          { status: 400, headers: NO_STORE }
        );
      pushSet(dbCol, v);
      continue;
    }
    if (k === "regulatoryStatus") {
      if (typeof v !== "string" || !VLM_REGULATORY_STATUSES.includes(v as VlmRegulatoryStatus))
        return Response.json(
          { error: `regulatoryStatus invalide (allowed: ${VLM_REGULATORY_STATUSES.join(", ")})` },
          { status: 400, headers: NO_STORE }
        );
      pushSet(dbCol, v);
      continue;
    }
    if (v === null) {
      sets.push(`${dbCol} = NULL`);
    } else {
      pushSet(dbCol, String(v));
    }
  }

  if (sets.length === 0) {
    return Response.json(
      { error: `aucun champ valide a mettre a jour (allowed: ${Object.keys(FIELD_MAP).join(", ")})` },
      { status: 400, headers: NO_STORE }
    );
  }
  sets.push(`updated_at = now()`);

  try {
    args.push(id);
    const updated = await adminQuery<Row>(
      `UPDATE core.vlm_regulatory r SET ${sets.join(", ")}
         WHERE r.id = $${args.length}
       RETURNING r.id, r.tenant_id,
         (SELECT slug FROM core.tenant WHERE id = r.tenant_id) AS tenant_slug,
         r.catalog_item_id, r.stock_item_id,
         r.ansm_file_number, r.ce_certificate_number, r.device_class,
         r.regulatory_status, r.compliance_notes, r.document_url,
         to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
         to_char(r.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at`,
      args
    );
    if (!updated[0]) {
      return Response.json({ error: "VLM regulatory introuvable" }, { status: 404, headers: NO_STORE });
    }
    return Response.json({ item: mapRow(updated[0]) }, { headers: NO_STORE });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur DB" },
      { status: 502, headers: NO_STORE }
    );
  }
}
