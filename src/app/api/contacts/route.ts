// Bloc 7R-SEC — POST + PUT contacts désormais verrouillés serveur.
// Avant : aucune auth (faille critique).
// Après : auth obligatoire + tenant courant résolu via hostname + check
// que le socid (POST) ou le contact (PUT) appartient bien au tenant.

import { createContact, updateContact, getThirdParty } from "@/lib/dolibarr";
import { resolveCockpitTenants } from "@/lib/tenant-resolver";
import { requireFeature } from "@/lib/tenant-features";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

export async function POST(request: Request) {
  const featureCheck = await requireFeature(request, "crm");
  if (!featureCheck.ok) return featureCheck.response;

  const cockpit = await resolveCockpitTenants(request);
  if (!cockpit.ok) {
    return Response.json({ error: cockpit.error }, { status: cockpit.status, headers: NO_STORE });
  }

  try {
    const body = await request.json();

    if (!body.lastname || !body.socid) {
      return Response.json(
        { error: "lastname et socid sont requis" },
        { status: 400, headers: NO_STORE }
      );
    }

    // Vérifier que le socid appartient au tenant courant
    try {
      await getThirdParty(String(body.socid), cockpit.tenant);
    } catch {
      return Response.json(
        { error: "socid introuvable dans le tenant courant" },
        { status: 404, headers: NO_STORE }
      );
    }

    const newId = await createContact(
      {
        firstname: body.firstname || "",
        lastname: body.lastname,
        socid: body.socid,
        email: body.email || "",
        phone_pro: body.phone_pro || "",
        phone_mobile: body.phone_mobile || "",
        poste: body.poste || "",
      },
      cockpit.tenant
    );

    return Response.json({ id: newId }, { status: 201, headers: NO_STORE });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur creation contact" },
      { status: 502, headers: NO_STORE }
    );
  }
}

export async function PUT(request: Request) {
  const featureCheck = await requireFeature(request, "crm");
  if (!featureCheck.ok) return featureCheck.response;

  const cockpit = await resolveCockpitTenants(request);
  if (!cockpit.ok) {
    return Response.json({ error: cockpit.error }, { status: cockpit.status, headers: NO_STORE });
  }

  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) {
      return Response.json({ error: "id requis" }, { status: 400, headers: NO_STORE });
    }

    // Vérifier que le contact existe dans le tenant courant.
    // Fetch direct Dolibarr du tenant : 404 → contact d'un autre tenant ou inexistant.
    const checkRes = await fetch(
      `${cockpit.tenant.url}/contacts/${encodeURIComponent(String(id))}`,
      { headers: { DOLAPIKEY: cockpit.tenant.apiKey } }
    );
    if (!checkRes.ok) {
      const status = checkRes.status === 404 ? 404 : 502;
      return Response.json(
        { error: "contact introuvable dans le tenant courant" },
        { status, headers: NO_STORE }
      );
    }

    await updateContact(String(id), data, cockpit.tenant);
    return Response.json({ success: true }, { headers: NO_STORE });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur mise a jour contact" },
      { status: 502, headers: NO_STORE }
    );
  }
}
