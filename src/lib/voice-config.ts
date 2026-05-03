export interface VoiceConfig {
  wsUrl: string;
  wakeWord: string;
}

// NEXT_PUBLIC_VOICE_ENABLED doit être "true" pour activer la voix.
// Tant que voice-poc n'est pas migré de Jacques vers Damien, on le laisse à false
// pour éviter les erreurs WebSocket dans la console.
// Flag pilote par NEXT_PUBLIC_VOICE_ENABLED (cf .env.local)
const VOICE_ENABLED = process.env.NEXT_PUBLIC_VOICE_ENABLED === "true";

const VOICE_AGENTS: Record<string, VoiceConfig> = {
  lea: {
    wsUrl: "wss://voice.mybotia.com/ws",
    wakeWord: "léa",
  },
  max: {
    wsUrl: "wss://voice-vlmedical.mybotia.com/ws",
    wakeWord: "max",
  },
  lucy: {
    wsUrl: "wss://voice-lucy.mybotia.com/ws",
    wakeWord: "lucy",
  },
  raphael: {
    wsUrl: "wss://voice-raphael.mybotia.com/ws",
    wakeWord: "raphaël",
  },
};

export function getVoiceConfig(agentId: string): VoiceConfig | null {
  if (!VOICE_ENABLED) return null;
  return VOICE_AGENTS[agentId.toLowerCase()] ?? null;
}

export function isVoiceEnabled(): boolean {
  return VOICE_ENABLED;
}
