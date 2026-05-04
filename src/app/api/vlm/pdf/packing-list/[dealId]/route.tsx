// Bloc 7G — Route PDF Packing List VL Medical.
// Génère à la demande, pas de stockage disque.
// Garde : requireVlmAccess + tenant deal=vlmedical (vérifié par packing-list-data).

import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireVlmAccess } from "@/lib/vlm-access";
import { getPackingListData } from "@/lib/pdf/vlm/packing-list-data";
import { PackingListDocument } from "@/lib/pdf/vlm/PackingListDocument";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

// react-pdf utilise les APIs Node (Buffer, stream) — runtime nodejs obligatoire.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const auth = await requireVlmAccess();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }

  const { dealId } = await params;
  if (!dealId || !/^[0-9a-f-]{36}$/i.test(dealId)) {
    return Response.json({ error: "dealId invalide" }, { status: 400, headers: NO_STORE });
  }

  let data;
  try {
    data = await getPackingListData(dealId);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur DB" },
      { status: 502, headers: NO_STORE }
    );
  }
  if (!data) {
    return Response.json(
      { error: "deal introuvable ou hors tenant vlmedical" },
      { status: 404, headers: NO_STORE }
    );
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderToBuffer(<PackingListDocument data={data} />);
  } catch (e) {
    console.error("[7G] PDF render error:", e instanceof Error ? e.message : String(e));
    return Response.json(
      { error: "Erreur génération PDF" },
      { status: 502, headers: NO_STORE }
    );
  }

  const filename =
    `packing-list-${(data.deal.ref || data.deal.id.slice(0, 8)).replace(/[^a-zA-Z0-9-]/g, "_")}.pdf`;

  return new Response(pdfBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": String(pdfBuffer.length),
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
