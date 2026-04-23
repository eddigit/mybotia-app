import {
  listConversations,
  sendAgentMessage,
  projectSessionId,
} from "@/lib/claude-bridge";
import { getSession } from "@/lib/session";

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
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Non authentifie" }, { status: 401 });
    }
    // Isolation par user_email par defaut, MEME pour superadmin.
    // Un superadmin peut explicitement passer ?scope=all pour voir toutes les
    // conversations (debug / supervision) — jamais par defaut.
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope");
    const showAll = session.isSuperadmin && scope === "all";
    const conversations = await listConversations(showAll ? undefined : session.email);
    return Response.json(conversations);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur conversations" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // 1. Authentification : recuperer la session depuis le cookie JWT
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Non authentifie" }, { status: 401 });
    }

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

    // 2. Determiner l'agent cote serveur (pas de confiance dans le client)
    const agentId = resolveAgentId(
      session.tenantSlug,
      requestedAgentId,
      session.isSuperadmin
    );

    // 3. Construire le userContext depuis la session JWT
    // TODO: enrichir le JWT avec first_name/last_name pour avoir un vrai nom humain
    const userContext = {
      name: session.email,
      email: session.email,
      role: session.role,
      tenant_slug: session.tenantSlug,
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
