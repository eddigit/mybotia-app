import { getThirdParties } from "@/lib/dolibarr";
import { getSession, getSessionTenants } from "@/lib/session";
import { mapThirdPartyToClient } from "@/lib/mappers";

export async function GET() {
  try {
    const tenants = await getSessionTenants();

    const allThirdparties = [];
    for (const tenant of tenants) {
      const tp = await getThirdParties(100, tenant).catch(() => []);
      allThirdparties.push(...tp);
    }

    const clients = allThirdparties
      .filter((tp) => tp.status !== "0" || tp.name.includes("TEST") === false)
      .map(mapThirdPartyToClient);

    return Response.json(clients);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur Dolibarr" },
      { status: 502 }
    );
  }
}
