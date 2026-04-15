import type { Agent } from "@/types";

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
    model: "Claude Opus 4.6",
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
    model: "Claude Opus 4.6",
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
    model: "Claude Sonnet 4.5",
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
    model: "Claude Opus 4.6",
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
    model: "Claude Opus 4.6",
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
    model: "Claude Sonnet 4.6",
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
    model: "Claude Sonnet 4.5",
    channels: ["telegram"],
    specialties: ["Finance", "Crypto", "Analyse marche", "Trading"],
    tasksCompleted: 156,
    responseTime: "< 3s",
  },
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

    // Normalize response — API might return array or object
    if (Array.isArray(data)) {
      const map: Record<string, { status: string; lastActive?: string }> = {};
      for (const agent of data) {
        const id = (agent.id || agent.name || "").toLowerCase();
        if (id) map[id] = { status: agent.status, lastActive: agent.lastActive };
      }
      return map;
    }
    return data;
  } catch {
    return null;
  }
}

export async function GET() {
  const liveStatus = await fetchLiveStatus();

  const agents: Agent[] = Object.entries(AGENT_META).map(([id, meta]) => {
    const live = liveStatus?.[id];
    return {
      id,
      ...meta,
      status: live ? mapStatus(live.status) : "offline",
      lastActive: live?.lastActive || undefined,
    };
  });

  return Response.json(agents);
}
