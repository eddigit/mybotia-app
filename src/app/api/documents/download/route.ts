// Bloc 7R-SEC — auth + tenant guard. Avant : aucune auth, clés API globales.
// Après : auth + tenant courant via hostname + clés Dolibarr du tenant courant.
// Dolibarr filtre côté DB par tenant (chaque tenant = sa propre instance) : un
// ref qui n'existe pas dans le Dolibarr du tenant courant retourne 404 propre.

import { NextRequest } from "next/server";
import { resolveCockpitTenants } from "@/lib/tenant-resolver";
import { requireFeature } from "@/lib/tenant-features";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

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
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur telechargement" },
      { status: 500, headers: NO_STORE }
    );
  }
}
