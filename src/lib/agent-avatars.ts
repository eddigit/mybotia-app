// Centralised agent avatar registry
// To add/change an avatar: just set the url here — all components pick it up automatically

export interface AgentAvatarConfig {
  url: string | null;
  initials: string;
  color: string;
}

export const AGENT_AVATARS: Record<string, AgentAvatarConfig> = {
  lea: {
    url: "https://res.cloudinary.com/dkvhbcuaz/image/upload/v1771478041/ChatGPT_Image_6_f%C3%A9vr._2026_02_37_27_rwbavh.png",
    initials: "LE",
    color: "bg-violet-600",
  },
  julian: {
    url: null,
    initials: "JU",
    color: "bg-sky-600",
  },
  nina: {
    url: null,
    initials: "NI",
    color: "bg-pink-600",
  },
  oscar: {
    url: null,
    initials: "OS",
    color: "bg-amber-600",
  },
  max: {
    url: "https://res.cloudinary.com/dniurvpzd/image/upload/q_auto/f_auto/v1772035906/Max_Vl_Medical_fdp3lu.jpg",
    initials: "MX",
    color: "bg-emerald-600",
  },
  lucy: {
    url: "https://res.cloudinary.com/dniurvpzd/image/upload/q_auto/f_auto/v1774210075/Capture_d_e%CC%81cran_2026-03-22_a%CC%80_21.06.45_d2bygw.png",
    initials: "LU",
    color: "bg-cyan-600",
  },
  bullsage: {
    url: null,
    initials: "BS",
    color: "bg-orange-600",
  },
  damien: {
    url: "https://res.cloudinary.com/dniurvpzd/image/upload/q_auto/f_auto/v1776346083/Avatar_Damien_lyagou.jpg",
    initials: "DA",
    color: "bg-blue-600",
  },
  raphael: {
    url: null,
    initials: "RA",
    color: "bg-indigo-600",
  },
  maria: {
    url: null,
    initials: "MA",
    color: "bg-rose-600",
  },
};

// Known user avatars (for non-agent display)
export const USER_AVATARS: Record<string, string> = {
  gilles: "https://res.cloudinary.com/dniurvpzd/image/upload/q_auto/f_auto/v1769611030/Gilles_Coach_Digital_f9bigk.jpg",
};

// Logo officiel MyBotIA
export const MYBOTIA_LOGO = "https://res.cloudinary.com/dniurvpzd/image/upload/q_auto/f_auto/v1772032713/Logo_Collaborateur_IA_coujhr.svg";

// Get avatar config for any agent ID (case-insensitive, with fallback)
export function getAgentAvatar(agentId: string): AgentAvatarConfig {
  const key = agentId.toLowerCase();
  return AGENT_AVATARS[key] || {
    url: null,
    initials: agentId.slice(0, 2).toUpperCase(),
    color: "bg-gray-600",
  };
}
