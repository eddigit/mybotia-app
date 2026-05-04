// Bloc 7J — GET liste events d'un devis VLM (audit log).

import { requireVlmAccess } from "@/lib/vlm-access";
import { getVlmQuoteRow } from "@/lib/vlm-quote-data";
import { listVlmQuoteEvents } from "@/lib/vlm-quote-events";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

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
    return Response.json({ error: "id invalide" }, { status: 400, headers: NO_STORE });
  }
  // Vérifier accès au devis (tenant vlmedical) avant de retourner ses events
  const quote = await getVlmQuoteRow(id);
  if (!quote) {
    return Response.json({ error: "devis introuvable" }, { status: 404, headers: NO_STORE });
  }
  try {
    const events = await listVlmQuoteEvents(id);
    return Response.json({ items: events }, { headers: NO_STORE });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur DB" },
      { status: 502, headers: NO_STORE }
    );
  }
}
