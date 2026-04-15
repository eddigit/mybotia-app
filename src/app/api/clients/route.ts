import { getThirdParties } from "@/lib/dolibarr";
import { mapThirdPartyToClient } from "@/lib/mappers";

export async function GET() {
  try {
    const thirdparties = await getThirdParties();
    const clients = thirdparties
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
