// Bloc 7E — VLM containers & marges : liste avec marges calculées.

import { adminQuery } from "@/lib/admin-db";
import { requireVlmAccess, VLM_SLUG } from "@/lib/vlm-access";
import { computeVlmDealMargin, type VlmContainerDeal } from "@/lib/vlm-types";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

interface Row {
  id: string;
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
  status: string;
  notes: string | null;
  created_at: string;
}

function num(v: string | null): number | null {
  return v === null ? null : parseFloat(v);
}

export async function GET() {
  const auth = await requireVlmAccess();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  try {
    const rows = await adminQuery<Row>(
      `SELECT cd.id, cd.ref, cd.title,
              cd.supplier_name, cd.origin_country, cd.destination_country, cd.container_type,
              cd.purchase_amount, cd.transport_cost, cd.customs_cost, cd.insurance_cost,
              cd.conditioning_cost, cd.other_cost, cd.sale_amount,
              cd.currency, cd.status, cd.notes,
              to_char(cd.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
         FROM core.vlm_container_deals cd
         JOIN core.tenant t ON t.id = cd.tenant_id
        WHERE t.slug = $1
        ORDER BY cd.status, cd.created_at DESC`,
      [VLM_SLUG]
    );
    const items = rows.map((r) => {
      const partial: VlmContainerDeal = {
        id: r.id,
        tenantId: "",
        tenantSlug: VLM_SLUG,
        deliveryId: null,
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
        status: r.status as VlmContainerDeal["status"],
        notes: r.notes,
        createdAt: r.created_at,
        updatedAt: r.created_at,
      };
      const m = computeVlmDealMargin(partial);
      return {
        id: r.id,
        ref: r.ref,
        title: r.title,
        supplierName: r.supplier_name,
        originCountry: r.origin_country,
        destinationCountry: r.destination_country,
        containerType: r.container_type,
        purchaseAmount: partial.purchaseAmount,
        transportCost: partial.transportCost,
        customsCost: partial.customsCost,
        insuranceCost: partial.insuranceCost,
        conditioningCost: partial.conditioningCost,
        otherCost: partial.otherCost,
        saleAmount: partial.saleAmount,
        currency: r.currency,
        status: r.status,
        notes: r.notes,
        createdAt: r.created_at,
        margin: m,
      };
    });
    return Response.json({ items }, { headers: NO_STORE });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur DB" },
      { status: 502, headers: NO_STORE }
    );
  }
}
