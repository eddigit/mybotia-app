// V1.1.G — Resolution agent par tenant (V1, source = map en mémoire).
//
// Doctrine :
//   Chaque tenant a un agent principal (dans la sidebar droite, le VoicePanel,
//   les conversations). Avant ce module, "Léa" était hardcodée dans plusieurs
//   composants UI, et le panneau ne basculait pas quand Gilles changeait de
//   cockpit (mybotia → vlmedical → igh). Ce module est la SOURCE UNIQUE pour
//   "quel est l'agent de ce tenant ?".
//
// V1 : map statique. Les voice IDs respectent la doctrine
//   `project_voice_id_par_genre` :
//     - toutes les voix ♀ = voice Léa (`WeAAwKYcS06VmXw086yZ`)
//     - toutes les voix ♂ = voice Max  (`eOwAMwUJEGkP44SKOXIH`)
//
// V2 : déplacer dans `core.tenant_settings.agents` ou `core.tenant_agents`
//   (côté DB) pour pouvoir provisionner sans modifier le code. Tant que la
//   DDL n'existe pas, on consomme cette map ; les composants UI passent par
//   `resolveTenantAgent()` qui sera l'unique point de bascule.

export type TenantAgent = {
  /** ID/slug technique de l'agent (ex: "lea", "max", "lucy", "raphael"). */
  slug: string;
  /** Nom affichable (avec accents). */
  name: string;
  /** Rôle court affiché sous le nom dans la sidebar droite. */
  role: string;
  /** Genre — utilisé pour le mapping voice ID par doctrine. */
  gender: "F" | "M";
  /** ElevenLabs voice ID. */
  voiceId: string;
  /** Présence WhatsApp activée pour ce tenant. */
  whatsappEnabled: boolean;
  /** Voice (real-time) activé pour ce tenant. */
  voiceEnabled: boolean;
};

// Voice IDs canoniques (doctrine project_voice_id_par_genre)
const VOICE_FEMALE = "WeAAwKYcS06VmXw086yZ"; // voix Léa
const VOICE_MALE = "eOwAMwUJEGkP44SKOXIH"; // voix Max

export const TENANT_AGENTS: Record<string, TenantAgent> = {
  mybotia: {
    slug: "lea",
    name: "Léa",
    role: "Assistante principale",
    gender: "F",
    voiceId: VOICE_FEMALE,
    whatsappEnabled: true,
    voiceEnabled: true,
  },
  vlmedical: {
    slug: "max",
    name: "Max",
    role: "Agent VL Medical",
    gender: "M",
    voiceId: VOICE_MALE,
    whatsappEnabled: true,
    voiceEnabled: true,
  },
  igh: {
    slug: "lucy",
    name: "Lucy",
    role: "Collaboratrice IGH",
    gender: "F",
    voiceId: VOICE_FEMALE,
    whatsappEnabled: false,
    voiceEnabled: true,
  },
  cmb_lux: {
    slug: "raphael",
    name: "Raphaël",
    role: "Agent CMB Luxembourg",
    gender: "M",
    voiceId: VOICE_MALE,
    whatsappEnabled: false,
    voiceEnabled: false,
  },
  esprit_loft: {
    slug: "maria",
    name: "Maria",
    role: "Agent Esprit Loft",
    gender: "F",
    voiceId: VOICE_FEMALE,
    whatsappEnabled: false,
    voiceEnabled: false,
  },
};

/**
 * Résout l'agent principal d'un tenant. Renvoie null si le tenant n'est
 * pas mappé — fail-closed, pas de fallback silencieux sur Léa.
 */
export function resolveTenantAgent(
  tenantSlug: string | null | undefined
): TenantAgent | null {
  if (!tenantSlug) return null;
  return TENANT_AGENTS[tenantSlug] ?? null;
}
