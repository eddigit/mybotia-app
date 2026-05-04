import type { Agent } from "@/types";
import { getSession } from "@/lib/session";

const MYBOTIA_API_URL = process.env.MYBOTIA_API_URL;
const MYBOTIA_API_TOKEN = process.env.MYBOTIA_API_TOKEN;

// Static agent metadata — enriches live status data
const AGENT_META: Record<
  string,
  Omit<Agent, "id" | "status" | "lastActive">
> = {
  lea: {
    name: "Lea",
    role: "Assistante principale",
    description:
      "Administration, orchestration, juridique. Coordinatrice de l'equipe IA.",
    model: "Premium",
    channels: ["whatsapp", "telegram", "webchat", "email"],
    specialties: [
      "Administration",
      "Juridique",
      "Orchestration",
      "Relation client",
    ],
    tasksCompleted: 847,
    responseTime: "< 3s",
  },
  julian: {
    name: "Julian",
    role: "Expert IT & Technique",
    description:
      "Operations, monitoring, debugging, infrastructure technique.",
    model: "Premium",
    channels: ["telegram"],
    specialties: ["Infrastructure", "Monitoring", "DevOps", "Debug"],
    tasksCompleted: 523,
    responseTime: "< 2s",
  },
  nina: {
    name: "Nina",
    role: "Communication & Social Media",
    description:
      "Gestion des reseaux sociaux, contenu, strategie de communication.",
    model: "Standard",
    channels: ["whatsapp", "telegram"],
    specialties: ["Social Media", "Contenu", "Communication", "Branding"],
    tasksCompleted: 312,
    responseTime: "< 5s",
  },
  oscar: {
    name: "Oscar",
    role: "Prospection commerciale",
    description:
      "Recherche prospects, qualification leads, suivi commercial.",
    model: "Premium",
    channels: ["telegram", "email"],
    specialties: [
      "Prospection",
      "Qualification",
      "CRM",
      "Suivi commercial",
    ],
    tasksCompleted: 689,
    responseTime: "< 4s",
  },
  max: {
    name: "Max",
    role: "Agent VL Medical",
    description:
      "Agent principal du client VL Medical. Administration et veille sectorielle.",
    model: "Premium",
    channels: ["whatsapp", "telegram"],
    specialties: [
      "Medical",
      "Veille sectorielle",
      "Administration",
      "Reglementation",
    ],
    tasksCompleted: 234,
    responseTime: "< 3s",
  },
  lucy: {
    name: "Lucy",
    role: "Collaboratrice IGH",
    description:
      "Agent dedie au groupe IGH (20 EHPAD/cliniques). Phase d'apprentissage.",
    model: "Standard",
    channels: ["whatsapp"],
    specialties: [
      "Sante",
      "EHPAD",
      "Gestion etablissements",
      "Reglementation",
    ],
    tasksCompleted: 45,
    responseTime: "< 5s",
  },
  bullsage: {
    name: "BullSage",
    role: "Finance & Crypto",
    description: "Analyse financiere, suivi crypto, veille marches.",
    model: "Standard",
    channels: ["telegram"],
    specialties: ["Finance", "Crypto", "Analyse marche", "Trading"],
    tasksCompleted: 156,
    responseTime: "< 3s",
  },
  raphael: {
    name: "Raphael",
    role: "Agent CMB Luxembourg",
    description:
      "Agent principal du client CMB Luxembourg. Configuration a finaliser.",
    model: "Premium",
    channels: ["whatsapp", "telegram", "email"],
    specialties: [
      "Conseil",
      "Gestion",
      "Administration",
      "Relation client",
    ],
    tasksCompleted: 0,
    responseTime: "< 3s",
  },
  maria: {
    name: "Maria",
    role: "Agent Esprit Loft",
    description:
      "Agent principal du client Esprit Loft (renovation). Configuration a finaliser.",
    model: "Premium",
    channels: ["whatsapp", "telegram", "email"],
    specialties: [
      "Renovation",
      "Suivi chantier",
      "Devis",
      "Relation client",
    ],
    tasksCompleted: 0,
    responseTime: "< 3s",
  },
};

// Mapping tenant → agents autorises (l'ordre determine l'agent "principal" affiche)
const TENANT_AGENTS: Record<string, string[]> = {
  mybotia: ["lea", "julian", "nina", "oscar", "bullsage"],
  vlmedical: ["max"],
  igh: ["lucy"],
  esprit_loft: ["maria"],
  cmb_lux: ["raphael"],
};

// Map API status to app status
function mapStatus(
  apiStatus: string | undefined
): Agent["status"] {
  if (!apiStatus) return "offline";
  const s = apiStatus.toLowerCase();
  if (s === "active" || s === "online" || s === "running") return "online";
  if (s === "busy" || s === "processing") return "busy";
  if (s === "listening" || s === "idle") return "listening";
  return "offline";
}

async function fetchLiveStatus(): Promise<
  Record<string, { status: string; lastActive?: string }> | null
> {
  if (!MYBOTIA_API_URL || !MYBOTIA_API_TOKEN) return null;

  try {
    const res = await fetch(`${MYBOTIA_API_URL}/agents/status`, {
      headers: { Authorization: `Bearer ${MYBOTIA_API_TOKEN}` },
      next: { revalidate: 30 },
    });

    if (!res.ok) return null;
    const data = await res.json();

    // Normalize response — API returns { agents: { lea: { status, ... }, ... } }
    const agents = data.agents || data;
    if (Array.isArray(agents)) {
      const map: Record<string, { status: string; lastActive?: string }> = {};
      for (const agent of agents) {
        const id = (agent.id || agent.name || "").toLowerCase();
        if (id) map[id] = { status: agent.status, lastActive: agent.lastActive };
      }
      return map;
    }
    return agents;
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();

  if (!session) {
    return Response.json([], {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const url = new URL(request.url);
  const wantAll = url.searchParams.get("all") === "true";

  const liveStatus = await fetchLiveStatus();

  // Par défaut : filtrer par tenant du user connecté (même pour superadmin).
  // ?all=true réservé aux pages admin (ex: /agents) qui listent tous les agents.
  const allowedIds =
    wantAll && session.isSuperadmin
      ? Object.keys(AGENT_META)
      : TENANT_AGENTS[session.tenantSlug] ?? [];

  const agents: Agent[] = allowedIds
    .filter((id) => AGENT_META[id])
    .map((id) => {
      const meta = AGENT_META[id];
      const live = liveStatus?.[id];
      return {
        id,
        ...meta,
        status: live ? mapStatus(live.status) : "offline",
        lastActive: live?.lastActive || undefined,
      };
    });

  return Response.json(agents, {
    headers: { "Cache-Control": "no-store" },
  });
}
