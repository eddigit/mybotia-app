// V1.1.B Phase 3D — Download document business-first.
//
// Avant : appel direct Dolibarr → 404 systématique pour mybotia (business-first).
// Après : route via crm-router :
//   - mybotia_business : lookup ID via liste quotes/invoices (filter `number`),
//     puis proxy binaire vers `/api/v1/{quotes|invoices}/{id}/pdf`.
//   - dolibarr        : flux legacy inchangé (autres tenants).
//   - external        : 501 explicite.
//
// Pas de stockage : business render-on-demand via `@react-pdf/renderer`.

import { NextRequest } from "next/server";
import { resolveCockpitTenants } from "@/lib/tenant-resolver";
import { requireFeature } from "@/lib/tenant-features";
import {
  getCrmProvider,
  CrmRouterError,
  crmRouterErrorResponse,
} from "@/lib/crm-router";
import {
  businessGetJson,
  businessFetchBinary,
  BusinessClientError,
} from "@/lib/business-client";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

type BusinessDocRow = {
  id: string;
  number: string;
};

export async function GET(request: NextRequest) {
  const featureCheck = await requireFeature(request, "documents");
  if (!featureCheck.ok) return featureCheck.response;

  const cockpit = await resolveCockpitTenants(request);
  if (!cockpit.ok) {
    return Response.json({ error: cockpit.error }, { status: cockpit.status, headers: NO_STORE });
  }

  const { searchParams } = request.nextUrl;
  const modulepart = searchParams.get("modulepart");
  const ref = searchParams.get("ref");

  if (!modulepart || !ref) {
    return Response.json(
      { error: "modulepart et ref sont requis" },
      { status: 400, headers: NO_STORE }
    );
  }

  try {
    const provider = await getCrmProvider(cockpit.slug);

    if (provider.kind === "external") {
      return Response.json(
        { error: "crm_provider_not_configured" },
        { status: 501, headers: NO_STORE },
      );
    }

    if (provider.kind === "mybotia_business") {
      // Normalise modulepart vers la collection business.
      const collection =
        modulepart === "facture" || modulepart === "invoice"
          ? "invoices"
          : modulepart === "propale" || modulepart === "propal" || modulepart === "proposal"
            ? "quotes"
            : null;

      if (!collection) {
        return Response.json(
          { error: "modulepart non supporté pour mybotia_business" },
          { status: 400, headers: NO_STORE },
        );
      }

      const claims = {
        tenantId: provider.tenantId,
        tenantSlug: cockpit.slug,
        scopes: ["crm:read"] as const,
      };

      // Lookup l'ID business par numéro. Pas de filter `number=` côté API,
      // on filtre côté app.
      let docs: BusinessDocRow[];
      try {
        docs = await businessGetJson<BusinessDocRow[]>(`/api/v1/${collection}`, claims);
      } catch (err) {
        if (err instanceof BusinessClientError) {
          return Response.json(
            { error: err.code, message: err.message },
            { status: err.status, headers: NO_STORE },
          );
        }
        throw err;
      }

      const match = docs.find((d) => d.number === ref);
      if (!match) {
        return Response.json(
          { error: "Document non disponible — créer un devis/facture côté CRM" },
          { status: 404, headers: NO_STORE },
        );
      }

      // Proxy binaire vers la route render-on-demand business.
      try {
        const bin = await businessFetchBinary(
          `/api/v1/${collection}/${match.id}/pdf`,
          claims,
        );
        const buffer = Buffer.from(await bin.blob.arrayBuffer());
        return new Response(buffer as unknown as BodyInit, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${ref}.pdf"`,
            "Content-Length": buffer.length.toString(),
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        });
      } catch (err) {
        if (err instanceof BusinessClientError) {
          return Response.json(
            { error: err.code, message: err.message },
            { status: err.status, headers: NO_STORE },
          );
        }
        throw err;
      }
    }

    // dolibarr (legacy) — flux inchangé
    const originalFile = `${ref}/${ref}.pdf`;
    const res = await fetch(
      `${cockpit.tenant.url}/documents/download?modulepart=${encodeURIComponent(modulepart)}&original_file=${encodeURIComponent(originalFile)}`,
      {
        headers: { DOLAPIKEY: cockpit.tenant.apiKey },
      }
    );

    if (!res.ok) {
      // 404 Dolibarr = ref absent du tenant courant. On normalise en 404 propre,
      // pas de fuite du message Dolibarr en clair.
      const status = res.status === 404 ? 404 : 502;
      return Response.json(
        { error: status === 404 ? "document introuvable dans le tenant courant" : "Erreur Dolibarr" },
        { status, headers: NO_STORE }
      );
    }

    const data = await res.json();

    // Dolibarr returns base64-encoded content
    if (data.content) {
      const buffer = Buffer.from(data.content, "base64");
      return new Response(buffer as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${data.filename || ref + ".pdf"}"`,
          "Content-Length": buffer.length.toString(),
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    return Response.json({ error: "Aucun contenu PDF" }, { status: 404, headers: NO_STORE });
  } catch (e) {
    if (e instanceof CrmRouterError) return crmRouterErrorResponse(e);
    if (e instanceof BusinessClientError) {
      return Response.json(
        { error: e.code, message: e.message },
        { status: e.status, headers: NO_STORE },
      );
    }
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur telechargement" },
      { status: 500, headers: NO_STORE }
    );
  }
}
