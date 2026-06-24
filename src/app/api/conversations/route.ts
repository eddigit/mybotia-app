import {
  listConversations,
  sendAgentMessage,
  projectSessionId,
} from "@/lib/claude-bridge";
import { resolveChatCockpit } from "@/lib/v4/session";

// Mapping tenant_slug -> agent_id
// Determine quel collaborateur IA repond par defaut selon le tenant du user connecte.
const TENANT_AGENT_MAP: Record<string, string> = {
  mybotia: "lea",
  vlmedical: "max",
  igh: "lucy",
  cmb_lux: "raphael",
  esprit_loft: "maria",
};

function resolveAgentId(
  tenantSlug: string,
  requestedAgentId: string | undefined,
  isSuperadmin: boolean
): string {
  // Le superadmin peut overrider l'agent via le body de la requete
  if (isSuperadmin && requestedAgentId) {
    return requestedAgentId;
  }
  // Sinon : l'agent est determine par le tenant du user connecte (non overridable)
  return TENANT_AGENT_MAP[tenantSlug] || "lea";
}

export async function GET(request: Request) {
  try {
    // V1.1.G — Filtre cockpit (tenant + agent) côté SQLite legacy.
    // Le bridge legacy n'expose pas de filtre tenant_slug/agent_id natif :
    // on filtre côté app après réception. Fail-closed si cockpit invalide.
    const cockpit = await resolveChatCockpit(request);
    if (!cockpit.ok) {
      return Response.json({ error: cockpit.error }, { status: cockpit.status });
    }
    const { session, tenantSlug, agentId } = cockpit;

    const url = new URL(request.url);
    const scope = url.searchParams.get("scope");
    const showAll = session.isSuperadmin && scope === "all";
    const all = await listConversations(tenantSlug);

    // Les conversations sont partagées au niveau tenant/projet : Gilles,
    // Sajjad et les futurs collaborateurs voient le même espace cockpit.
    // Le filtre agent reste un garde-fou si le bridge renvoie plus large.
    type Row = { agentId?: string | null } & Record<string, unknown>;
    const rows = all as unknown as Row[];
    const filtered = showAll
      ? rows
      : rows.filter((r) => {
          const aId = (r as Row & { agentId?: string }).agentId ?? null;
          return aId === agentId;
        });

    return Response.json(filtered);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur conversations" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // V1.1.G — POST aussi scope cockpit (sinon création tagée tenant JWT).
    const cockpit = await resolveChatCockpit(request);
    if (!cockpit.ok) {
      return Response.json({ error: cockpit.error }, { status: cockpit.status });
    }
    const { session, tenantSlug, agentId: cockpitAgent } = cockpit;

    const body = await request.json();
    const {
      agentId: requestedAgentId,
      message,
      sessionId,
      projectId,
      projectRef,
      projectName,
      clientName,
      projectDescription,
      modelTier: requestedModelTier,
    } = body;

    // Sanitize tier — n'accepte que "fast" ou "deep" ; defaut "fast"
    const modelTier: "fast" | "deep" =
      requestedModelTier === "deep" ? "deep" : "fast";

    if (!message) {
      return Response.json({ error: "message est requis" }, { status: 400 });
    }

    // 2. Agent : superadmin peut overrider, sinon agent cockpit forcé.
    const agentId = session.isSuperadmin
      ? resolveAgentId(tenantSlug, requestedAgentId, true)
      : cockpitAgent;

    // 3. userContext propage le tenant cockpit (pas tenant JWT).
    const userContext = {
      name: session.email,
      email: session.email,
      role: session.role,
      tenant_slug: tenantSlug,
      is_superadmin: session.isSuperadmin,
    };

    // 4. Session ID deterministe pour un projet, sinon on utilise celui fourni
    const effectiveSessionId =
      sessionId ||
      (projectId ? projectSessionId(projectId, agentId) : undefined);

    // 5. Construire le projectContext si fourni
    const projectContext =
      projectRef && projectName
        ? {
            projectRef,
            projectName,
            clientName,
            description: projectDescription,
          }
        : undefined;

    // 6. Envoyer au bridge avec TOUT le contexte + tier du modele
    const response = await sendAgentMessage(
      agentId,
      message,
      effectiveSessionId,
      projectContext,
      userContext,
      undefined, // onStatus (non-streaming ici)
      undefined, // onDelta
      modelTier
    );

    if (response.error) {
      return Response.json({ error: response.error }, { status: 502 });
    }

    return Response.json(response);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur envoi message" },
      { status: 500 }
    );
  }
}
