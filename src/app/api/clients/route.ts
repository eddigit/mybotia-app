import {
  getThirdParties,
  getThirdPartiesByCategory,
  getThirdParty,
  createThirdParty,
  assignThirdPartyCategory,
} from "@/lib/dolibarr";
import { mapThirdPartyToClient } from "@/lib/mappers";
import { getTenantScope } from "@/lib/tenant";

export async function GET() {
  try {
    const scope = await getTenantScope();
    let thirdparties;

    if (scope.isSuperadmin) {
      thirdparties = await getThirdParties();
    } else if (scope.categoryId) {
      thirdparties = await getThirdPartiesByCategory(scope.categoryId);
    } else if (scope.thirdpartyIds) {
      thirdparties = await Promise.all(
        scope.thirdpartyIds.map((id) => getThirdParty(id))
      );
    } else {
      thirdparties = await getThirdParties();
    }

    const clients = thirdparties
      .filter((tp) => tp.status !== "0" || !tp.name.includes("TEST"))
      .map(mapThirdPartyToClient);

    return Response.json(clients);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur Dolibarr" },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const scope = await getTenantScope();
    const body = await request.json();

    const newId = await createThirdParty({
      name: body.name,
      name_alias: body.name_alias || "",
      email: body.email || "",
      phone: body.phone || "",
      address: body.address || "",
      zip: body.zip || "",
      town: body.town || "",
      country_code: body.country_code || "FR",
      client: body.client || "1",
      prospect: body.prospect || "0",
      fournisseur: body.fournisseur || "0",
      note_public: body.note_public || "",
      note_private: body.note_private || "",
    });

    // Auto-assign to tenant category
    if (scope.categoryId) {
      await assignThirdPartyCategory(String(newId), scope.categoryId);
    }

    return Response.json({ id: newId }, { status: 201 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur creation" },
      { status: 502 }
    );
  }
}
