// Bloc 7E — VLM deliveries : liste livraisons VLM.

import { adminQuery } from "@/lib/admin-db";
import { requireVlmAccess, VLM_SLUG } from "@/lib/vlm-access";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

interface Row {
  id: string;
  ref: string | null;
  client_name: string | null;
  title: string;
  ship_from: string | null;
  ship_to: string | null;
  carrier: string | null;
  status: string;
  expected_date: string | null;
  delivered_at: string | null;
  transport_cost: string | null;
  currency: string;
  tracking_number: string | null;
  created_at: string;
}

export async function GET() {
  const auth = await requireVlmAccess();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  try {
    const rows = await adminQuery<Row>(
      `SELECT d.id, d.ref, d.client_name, d.title, d.ship_from, d.ship_to, d.carrier,
              d.status,
              to_char(d.expected_date, 'YYYY-MM-DD') AS expected_date,
              to_char(d.delivered_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS delivered_at,
              d.transport_cost, d.currency, d.tracking_number,
              to_char(d.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
         FROM core.deliveries d
         JOIN core.tenant t ON t.id = d.tenant_id
        WHERE t.slug = $1
        ORDER BY d.expected_date NULLS LAST, d.created_at DESC`,
      [VLM_SLUG]
    );
    return Response.json(
      {
        items: rows.map((r) => ({
          id: r.id,
          ref: r.ref,
          clientName: r.client_name,
          title: r.title,
          shipFrom: r.ship_from,
          shipTo: r.ship_to,
          carrier: r.carrier,
          status: r.status,
          expectedDate: r.expected_date,
          deliveredAt: r.delivered_at,
          transportCost: r.transport_cost !== null ? parseFloat(r.transport_cost) : null,
          currency: r.currency,
          trackingNumber: r.tracking_number,
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
