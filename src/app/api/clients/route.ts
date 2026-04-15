import {
  getThirdParties,
  getThirdPartiesByCategory,
  getThirdParty,
} from "@/lib/dolibarr";
import { mapThirdPartyToClient } from "@/lib/mappers";
import { getTenantScope } from "@/lib/tenant";

export async function GET() {
  try {
    const scope = await getTenantScope();
    let thirdparties;

    if (scope.isSuperadmin) {
      // Superadmin sees everything
      thirdparties = await getThirdParties();
    } else if (scope.categoryId) {
      // Filter by Dolibarr category
      thirdparties = await getThirdPartiesByCategory(scope.categoryId);
    } else if (scope.thirdpartyIds) {
      // Single-client tenant — fetch specific thirdparties
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
