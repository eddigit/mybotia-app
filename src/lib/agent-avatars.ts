// Centralised agent avatar registry
// To add/change an avatar: just set the url here — all components pick it up automatically

export interface AgentAvatarConfig {
  url: string | null;
  initials: string;
  color: string;
}

export interface HumanAvatarConfig {
  url: string | null;
  initials: string;
  label: string;
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
    url: "https://res.cloudinary.com/dniurvpzd/image/upload/v1777016211/Raphael_CMB_oehdpr.jpg",
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

const HUMAN_AVATARS: Record<string, HumanAvatarConfig> = {
  gilles: {
    url: USER_AVATARS.gilles,
    initials: "GK",
    label: "Gilles",
    color: "bg-sky-700",
  },
  saddjaad: {
    url: null,
    initials: "SO",
    label: "Saddjaad",
    color: "bg-emerald-700",
  },
  whatsapp: {
    url: null,
    initials: "WA",
    label: "WhatsApp",
    color: "bg-green-700",
  },
  audit: {
    url: null,
    initials: "AU",
    label: "Audit",
    color: "bg-slate-600",
  },
  eval: {
    url: null,
    initials: "EV",
    label: "Evaluation",
    color: "bg-indigo-700",
  },
  system: {
    url: null,
    initials: "SY",
    label: "Systeme",
    color: "bg-zinc-600",
  },
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

function initialsFromLabel(label: string): string {
  return (
    label
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "??"
  );
}

function labelFromEmail(email: string): string {
  const localPart = email.split("@")[0] || email;
  return localPart.replace(/[._-]+/g, " ").trim() || email;
}

export function getHumanAvatar(input?: {
  email?: string | null;
  name?: string | null;
  fallbackLabel?: string | null;
}): HumanAvatarConfig {
  const email = (input?.email || "").trim();
  const name = (input?.name || "").trim();
  const fallbackLabel = (input?.fallbackLabel || "").trim();
  const probe = `${email} ${name} ${fallbackLabel}`.toLowerCase();

  if (probe.includes("gilleskorzec") || /\bgilles\b/.test(probe)) {
    return HUMAN_AVATARS.gilles;
  }
  if (
    probe.includes("saddjaad") ||
    probe.includes("sajad") ||
    probe.includes("omarjee")
  ) {
    return HUMAN_AVATARS.saddjaad;
  }
  if (probe.includes("@whatsapp") || probe.includes("@lid") || probe.includes("@g.us")) {
    return HUMAN_AVATARS.whatsapp;
  }
  if (probe.includes("audit")) {
    return HUMAN_AVATARS.audit;
  }
  if (probe.includes("eval")) {
    return HUMAN_AVATARS.eval;
  }
  if (probe.includes("bot") || probe.includes("system")) {
    return HUMAN_AVATARS.system;
  }

  const label = name || (email ? labelFromEmail(email) : fallbackLabel) || "Utilisateur";
  return {
    url: null,
    initials: initialsFromLabel(label),
    label,
    color: "bg-zinc-700",
  };
}
