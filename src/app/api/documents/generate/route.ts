// Bloc 7R-SEC — auth + tenant guard. Avant : aucune auth, clés API globales.
// Après : auth + tenant courant via hostname + clés Dolibarr du tenant courant.
// Dolibarr filtre côté DB par tenant ; un ref absent du tenant courant retourne
// 404 et la route le normalise sans fuite.

import { resolveCockpitTenants } from "@/lib/tenant-resolver";
import { requireFeature } from "@/lib/tenant-features";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

export async function POST(request: Request) {
  const featureCheck = await requireFeature(request, "documents");
  if (!featureCheck.ok) return featureCheck.response;

  const cockpit = await resolveCockpitTenants(request);
  if (!cockpit.ok) {
    return Response.json({ error: cockpit.error }, { status: cockpit.status, headers: NO_STORE });
  }

  try {
    const body = await request.json();
    const { modulepart, ref, doctemplate } = body as {
      modulepart: string;
      ref: string;
      doctemplate?: string;
    };

    if (!modulepart || !ref) {
      return Response.json(
        { error: "modulepart et ref sont requis" },
        { status: 400, headers: NO_STORE }
      );
    }

    // Map modulepart to Dolibarr expected values
    const moduleMap: Record<string, string> = {
      facture: "facture",
      propale: "propale",
      propal: "propale",
    };
    const doliModule = moduleMap[modulepart] || modulepart;

    // Default templates per module
    const defaultTemplates: Record<string, string> = {
      facture: "sponge",
      propale: "cyan",
    };
    const template = doctemplate || defaultTemplates[doliModule] || "crabe";

    const res = await fetch(`${cockpit.tenant.url}/documents/builddoc`, {
      method: "PUT",
      headers: {
        DOLAPIKEY: cockpit.tenant.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        modulepart: doliModule,
        original_file: `${ref}/${ref}.pdf`,
        doctemplate: template,
        langcode: "fr_FR",
      }),
    });

    if (!res.ok) {
      // Normalisation : 404 Dolibarr (ref absent du tenant) ou erreurs
      // techniques. Pas de fuite du message brut Dolibarr.
      const status = res.status === 404 ? 404 : 502;
      return Response.json(
        {
          error:
            status === 404
              ? "document introuvable dans le tenant courant"
              : "Erreur Dolibarr",
        },
        { status, headers: NO_STORE }
      );
    }

    const data = await res.json();
    return Response.json(
      {
        filename: data.filename || `${ref}.pdf`,
        content: data.content || null,
        filesize: data.filesize || 0,
      },
      { headers: NO_STORE }
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur generation PDF" },
      { status: 500, headers: NO_STORE }
    );
  }
}
