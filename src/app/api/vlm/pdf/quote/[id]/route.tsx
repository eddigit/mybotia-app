// Bloc 7H — Route PDF Devis VL Medical (génération à la demande, pas de stockage).

import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireVlmAccess } from "@/lib/vlm-access";
import { getVlmQuote } from "@/lib/vlm-quote-data";
import { VlmQuoteDocument } from "@/lib/pdf/vlm/VlmQuoteDocument";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireVlmAccess();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  const { id } = await params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ error: "id devis invalide" }, { status: 400, headers: NO_STORE });
  }

  let quote;
  try {
    quote = await getVlmQuote(id);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur DB" },
      { status: 502, headers: NO_STORE }
    );
  }
  if (!quote) {
    return Response.json(
      { error: "devis introuvable ou hors tenant vlmedical" },
      { status: 404, headers: NO_STORE }
    );
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderToBuffer(<VlmQuoteDocument quote={quote} />);
  } catch (e) {
    console.error("[7H] PDF render error:", e instanceof Error ? e.message : String(e));
    return Response.json(
      { error: "Erreur génération PDF" },
      { status: 502, headers: NO_STORE }
    );
  }

  const filename = `devis-${quote.ref.replace(/[^a-zA-Z0-9-]/g, "_")}.pdf`;
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
