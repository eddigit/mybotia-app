export interface VoiceConfig {
  wsUrl: string;
  wakeWord: string;
}

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
};

export function getVoiceConfig(agentId: string): VoiceConfig | null {
  return VOICE_AGENTS[agentId.toLowerCase()] ?? null;
}
