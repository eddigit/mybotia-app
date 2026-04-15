// Agents: static config for now (agents are defined in OpenClaw, not Dolibarr)
// Will be connected to gateway status API in a future phase.

import { agents } from "@/data/mock";

export async function GET() {
  return Response.json(agents);
}
