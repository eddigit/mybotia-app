// Bloc 7D — VLM container deals : GET liste + POST création.

import { adminQuery } from "@/lib/admin-db";
import { requireSuperadmin } from "@/lib/admin-auth";
import {
  VLM_DEAL_STATUSES,
  type VlmContainerDeal,
  type VlmDealStatus,
} from "@/lib/vlm-types";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;
const VLM_SLUG = "vlmedical";

interface Row {
  id: string;
  tenant_id: string;
  tenant_slug: string;
  delivery_id: string | null;
  ref: string | null;
  title: string;
  supplier_name: string | null;
  origin_country: string | null;
  destination_country: string | null;
  container_type: string | null;
  purchase_amount: string | null;
  transport_cost: string | null;
  customs_cost: string | null;
  insurance_cost: string | null;
  conditioning_cost: string | null;
  other_cost: string | null;
  sale_amount: string | null;
  currency: string;
  status: VlmDealStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function num(v: string | null): number | null {
  return v === null ? null : parseFloat(v);
}

function mapRow(r: Row): VlmContainerDeal {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    tenantSlug: r.tenant_slug,
    deliveryId: r.delivery_id,
    ref: r.ref,
    title: r.title,
    supplierName: r.supplier_name,
    originCountry: r.origin_country,
    destinationCountry: r.destination_country,
    containerType: r.container_type,
    purchaseAmount: num(r.purchase_amount),
    transportCost: num(r.transport_cost),
    customsCost: num(r.customs_cost),
    insuranceCost: num(r.insurance_cost),
    conditioningCost: num(r.conditioning_cost),
    otherCost: num(r.other_cost),
    saleAmount: num(r.sale_amount),
    currency: r.currency,
    status: r.status,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const SELECT_COLS = `cd.id, cd.tenant_id, t.slug AS tenant_slug,
  cd.delivery_id, cd.ref, cd.title,
  cd.supplier_name, cd.origin_country, cd.destination_country, cd.container_type,
  cd.purchase_amount, cd.transport_cost, cd.customs_cost, cd.insurance_cost,
  cd.conditioning_cost, cd.other_cost, cd.sale_amount,
  cd.currency, cd.status, cd.notes,
  to_char(cd.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
  to_char(cd.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at`;

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
         FROM core.vlm_container_deals cd
         JOIN core.tenant t ON t.id = cd.tenant_id
        WHERE t.slug = $1
        ORDER BY cd.status, cd.created_at DESC`,
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
  deliveryId?: string | null;
  ref?: string | null;
  title: string;
  supplierName?: string | null;
  originCountry?: string | null;
  destinationCountry?: string | null;
  containerType?: string | null;
  purchaseAmount?: number | null;
  transportCost?: number | null;
  customsCost?: number | null;
  insuranceCost?: number | null;
  conditioningCost?: number | null;
  otherCost?: number | null;
  saleAmount?: number | null;
  currency?: string;
  status?: VlmDealStatus;
  notes?: string | null;
}

const NUMERIC_FIELDS = [
  "purchaseAmount",
  "transportCost",
  "customsCost",
  "insuranceCost",
  "conditioningCost",
  "otherCost",
  "saleAmount",
] as const;

function parseAmount(v: unknown): number | null | "INVALID" {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return "INVALID";
  return n;
}

function validateCreate(body: unknown): { ok: true; data: CreateBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "body invalide" };
  const b = body as Record<string, unknown>;
  if (typeof b.tenantSlug !== "string" || !b.tenantSlug)
    return { ok: false, error: "tenantSlug requis" };
  if (b.tenantSlug !== VLM_SLUG)
    return { ok: false, error: "VLM custom vertical réservé au tenant vlmedical" };
  if (typeof b.title !== "string" || !b.title.trim())
    return { ok: false, error: "title requis" };
  const status = typeof b.status === "string" ? b.status : "draft";
  if (!VLM_DEAL_STATUSES.includes(status as VlmDealStatus))
    return { ok: false, error: `status invalide (allowed: ${VLM_DEAL_STATUSES.join(", ")})` };

  const amounts: Record<string, number | null> = {};
  for (const f of NUMERIC_FIELDS) {
    const r = parseAmount(b[f]);
    if (r === "INVALID")
      return { ok: false, error: `${f} doit etre >= 0 ou null` };
    amounts[f] = r;
  }

  const deliveryId =
    typeof b.deliveryId === "string" && /^[0-9a-f-]{36}$/i.test(b.deliveryId) ? b.deliveryId : null;

  return {
    ok: true,
    data: {
      tenantSlug: VLM_SLUG,
      deliveryId,
      ref: typeof b.ref === "string" && b.ref.trim() ? b.ref.trim() : null,
      title: b.title.trim(),
      supplierName: typeof b.supplierName === "string" && b.supplierName.trim() ? b.supplierName.trim() : null,
      originCountry: typeof b.originCountry === "string" && b.originCountry.trim() ? b.originCountry.trim() : null,
      destinationCountry: typeof b.destinationCountry === "string" && b.destinationCountry.trim() ? b.destinationCountry.trim() : null,
      containerType: typeof b.containerType === "string" && b.containerType.trim() ? b.containerType.trim() : null,
      purchaseAmount: amounts.purchaseAmount,
      transportCost: amounts.transportCost,
      customsCost: amounts.customsCost,
      insuranceCost: amounts.insuranceCost,
      conditioningCost: amounts.conditioningCost,
      otherCost: amounts.otherCost,
      saleAmount: amounts.saleAmount,
      currency: typeof b.currency === "string" && b.currency ? b.currency : "EUR",
      status: status as VlmDealStatus,
      notes: typeof b.notes === "string" ? b.notes : null,
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

    if (d.deliveryId) {
      const dlvCheck = await adminQuery<{ id: string }>(
        "SELECT id FROM core.deliveries WHERE id = $1 AND tenant_id = $2",
        [d.deliveryId, tenantId]
      );
      if (!dlvCheck[0]) {
        return Response.json({ error: "deliveryId hors tenant vlmedical" }, { status: 400, headers: NO_STORE });
      }
    }

    const inserted = await adminQuery<{ r_id: string }>(
      `INSERT INTO core.vlm_container_deals
         (tenant_id, delivery_id, ref, title,
          supplier_name, origin_country, destination_country, container_type,
          purchase_amount, transport_cost, customs_cost, insurance_cost,
          conditioning_cost, other_cost, sale_amount,
          currency, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING id AS r_id`,
      [
        tenantId,
        d.deliveryId,
        d.ref,
        d.title,
        d.supplierName,
        d.originCountry,
        d.destinationCountry,
        d.containerType,
        d.purchaseAmount,
        d.transportCost,
        d.customsCost,
        d.insuranceCost,
        d.conditioningCost,
        d.otherCost,
        d.saleAmount,
        d.currency,
        d.status,
        d.notes,
      ]
    );
    const newId = inserted[0].r_id;
    const rows = await adminQuery<Row>(
      `SELECT ${SELECT_COLS}
         FROM core.vlm_container_deals cd
         JOIN core.tenant t ON t.id = cd.tenant_id
        WHERE cd.id = $1`,
      [newId]
    );
    return Response.json({ item: mapRow(rows[0]) }, { status: 201, headers: NO_STORE });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur DB";
    const status = /unique|duplicate/i.test(msg) ? 409 : 502;
    return Response.json({ error: msg }, { status, headers: NO_STORE });
  }
}
