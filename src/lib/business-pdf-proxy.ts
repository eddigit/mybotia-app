// V1.1.E — Helper partagé pour les routes proxy PDF app -> mybotia-business.
//
// Routes consommatrices :
//   - GET /api/quotes/[id]/pdf
//   - GET /api/invoices/[id]/pdf
//
// Pattern : récupère la session utilisateur (cookie mybotia_access),
// vérifie la feature `documents` côté cockpit, route vers le provider CRM,
// si business -> proxy binaire vers /api/v1/{collection}/{id}/pdf.
//
// Sécurité :
//   - actor_id propagé depuis la session app (userId) -> claims service JWT.
//   - 403 biz (mauvais droit / mauvais tenant) -> 403 app propre.
//   - 404 biz (resource not found) -> 404 app propre.
//   - 401 biz (token invalide) -> 502 (problème infra côté app).
//   - Pas de fuite de message biz brut côté client.

import { NextRequest } from "next/server";
import { resolveCockpitTenants } from "@/lib/tenant-resolver";
import { requireFeature } from "@/lib/tenant-features";
import {
  getCrmProvider,
  CrmRouterError,
  crmRouterErrorResponse,
} from "@/lib/crm-router";
import { businessFetchBinary, BusinessClientError } from "@/lib/business-client";
import { getSession } from "@/lib/session";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
} as const;

export type PdfCollection = "quotes" | "invoices";

const COLLECTION_PREFIX: Record<PdfCollection, string> = {
  quotes: "DEV", // fallback si business ne propose pas de Content-Disposition
  invoices: "FAC",
};

/**
 * Stream un PDF business pour la collection demandée. Renvoie une Response
 * Next.js prête (binaire ou JSON d'erreur).
 */
export async function proxyBusinessPdf(
  request: NextRequest,
  collection: PdfCollection,
  rawId: string,
): Promise<Response> {
  // Validation minimale ID — biz fait la validation UUID stricte (zod)
  // et renverra 400 si malformé. On bloque uniquement les valeurs vides.
  if (!rawId || rawId.length < 8) {
    return Response.json(
      { error: "id manquant ou invalide" },
      { status: 400, headers: NO_STORE },
    );
  }

  // 1) Feature `documents` activée pour le cockpit ?
  const featureCheck = await requireFeature(request, "documents");
  if (!featureCheck.ok) return featureCheck.response;

  // 2) Cockpit + tenant
  const cockpit = await resolveCockpitTenants(request);
  if (!cockpit.ok) {
    return Response.json(
      { error: cockpit.error },
      { status: cockpit.status, headers: NO_STORE },
    );
  }

  // 3) Session app (pour propager actor_id côté biz)
  //    Pas de session -> 401 (route protégée par cookie mybotia_access).
  const session = await getSession();
  if (!session) {
    return Response.json(
      { error: "unauthenticated" },
      { status: 401, headers: NO_STORE },
    );
  }

  try {
    const provider = await getCrmProvider(cockpit.slug);

    if (provider.kind !== "mybotia_business") {
      // Tenants Dolibarr ou external -> les PDF passent par
      // /api/documents/download (lookup par ref). Cette route est strictement
      // business-first.
      return Response.json(
        {
          error: "crm_provider_not_business",
          message:
            "Cette route est réservée aux tenants mybotia_business. " +
            "Utiliser /api/documents/download pour Dolibarr.",
        },
        { status: 501, headers: NO_STORE },
      );
    }

    const claims = {
      tenantId: provider.tenantId,
      tenantSlug: cockpit.slug,
      actorType: "platform" as const,
      actorId: session.userId,
      scopes: ["crm:read"] as const,
    };

    let bin;
    try {
      bin = await businessFetchBinary(
        `/api/v1/${collection}/${encodeURIComponent(rawId)}/pdf`,
        claims,
      );
    } catch (err) {
      if (err instanceof BusinessClientError) {
        // Mapping propre status biz -> status app
        if (err.status === 404) {
          return Response.json(
            { error: "not_found", message: "Document introuvable" },
            { status: 404, headers: NO_STORE },
          );
        }
        if (err.status === 403) {
          return Response.json(
            { error: "forbidden", message: "Accès refusé pour ce document" },
            { status: 403, headers: NO_STORE },
          );
        }
        if (err.status === 400) {
          return Response.json(
            { error: "bad_request", message: err.message },
            { status: 400, headers: NO_STORE },
          );
        }
        // 401 biz = problème JWT_SERVICE_SECRET / clock skew -> 502 côté app
        if (err.status === 401) {
          return Response.json(
            { error: "business_auth_failed" },
            { status: 502, headers: NO_STORE },
          );
        }
        // 5xx biz / network
        return Response.json(
          { error: err.code, message: "Erreur génération PDF" },
          { status: err.status >= 500 ? 502 : err.status, headers: NO_STORE },
        );
      }
      throw err;
    }

    // Re-propage Content-Disposition biz si présent, sinon fallback DEV-/FAC-
    const buffer = Buffer.from(await bin.blob.arrayBuffer());
    const disposition =
      bin.contentDisposition ||
      `attachment; filename="${COLLECTION_PREFIX[collection]}-${rawId}.pdf"`;

    return new Response(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": disposition,
        "Content-Length": buffer.length.toString(),
        ...NO_STORE,
      },
    });
  } catch (e) {
    if (e instanceof CrmRouterError) return crmRouterErrorResponse(e);
    return Response.json(
      {
        error:
          e instanceof Error ? e.message : "Erreur proxy PDF business",
      },
      { status: 500, headers: NO_STORE },
    );
  }
}
