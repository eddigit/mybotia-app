import { getCommercialDocumentDetails, type CommercialDocumentType } from "@/lib/dolibarr";
import { resolveCockpitTenants } from "@/lib/tenant-resolver";
import { requireFeature } from "@/lib/tenant-features";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;
const VALID_TYPES = new Set<CommercialDocumentType>(["proposal", "invoice", "credit_note"]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await params;

  if (!VALID_TYPES.has(type as CommercialDocumentType)) {
    return Response.json(
      { error: "type doit être 'proposal', 'invoice' ou 'credit_note'" },
      { status: 400, headers: NO_STORE },
    );
  }
  if (!id || !/^\d+$/.test(id)) {
    return Response.json(
      { error: "id numérique requis" },
      { status: 400, headers: NO_STORE },
    );
  }

  const featureCheck = await requireFeature(request, "documents");
  if (!featureCheck.ok) return featureCheck.response;

  const cockpit = await resolveCockpitTenants(request);
  if (!cockpit.ok) {
    return Response.json({ error: cockpit.error }, { status: cockpit.status, headers: NO_STORE });
  }

  try {
    const details = await getCommercialDocumentDetails(
      type as CommercialDocumentType,
      id,
      cockpit.tenant,
    );
    return Response.json(details, { headers: NO_STORE });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur Dolibarr";
    const status = msg.includes("introuvable") ? 404 : 502;
    return Response.json({ error: msg }, { status, headers: NO_STORE });
  }
}
