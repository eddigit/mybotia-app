// V1.1.B Phase 3D — Generate document business-first.
//
// Avant : appel direct Dolibarr `/documents/builddoc` → 404 systématique
// pour mybotia (business-first).
// Après : route via crm-router :
//   - mybotia_business : pas de pré-génération (render-on-demand au GET /pdf),
//     on retourne juste { ok: true, source } pour que la FSM UI bascule en
//     "ready". Le PDF binaire arrive via /api/documents/download.
//   - dolibarr        : flux legacy `/documents/builddoc` inchangé.
//   - external        : 501 explicite.

import { resolveCockpitTenants } from "@/lib/tenant-resolver";
import { requireFeature } from "@/lib/tenant-features";
import {
  getCrmProvider,
  CrmRouterError,
  crmRouterErrorResponse,
} from "@/lib/crm-router";
import { BusinessClientError } from "@/lib/business-client";

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

    const provider = await getCrmProvider(cockpit.slug);

    if (provider.kind === "external") {
      return Response.json(
        { error: "crm_provider_not_configured" },
        { status: 501, headers: NO_STORE },
      );
    }

    if (provider.kind === "mybotia_business") {
      // Render-on-demand : aucun fichier à pré-générer côté business.
      // Le binaire est produit à chaque GET /pdf via @react-pdf/renderer.
      return Response.json(
        {
          ok: true,
          ref,
          source: "mybotia_business",
          note: "Rendu à la demande lors du téléchargement",
        },
        { headers: NO_STORE },
      );
    }

    // dolibarr (legacy) — flux inchangé.
    // Map modulepart aux valeurs attendues par l'API Dolibarr /documents/builddoc.
    // L'API builddoc accepte 'propal' ou 'proposal' pour les devis (PAS 'propale' avec e final),
    // 'facture' ou 'invoice' pour les factures. Voir api_documents.class.php:279.
    // Source MyBotIA peut envoyer 'propale' (alias FR) ; on normalise vers 'propal'.
    const moduleMap: Record<string, string> = {
      facture: "facture",
      invoice: "facture",
      propale: "propal",
      propal: "propal",
      proposal: "propal",
    };
    const doliModule = moduleMap[modulepart] || modulepart;

    // Default templates par module si l'appelant n'en fournit pas.
    // Aligné sur la const Dolibarr globale ('azur' pour propale, 'crabe' pour facture).
    const defaultTemplates: Record<string, string> = {
      facture: "crabe",
      propal: "azur",
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
    if (e instanceof CrmRouterError) return crmRouterErrorResponse(e);
    if (e instanceof BusinessClientError) {
      return Response.json(
        { error: e.code, message: e.message },
        { status: e.status, headers: NO_STORE },
      );
    }
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur generation PDF" },
      { status: 500, headers: NO_STORE }
    );
  }
}
