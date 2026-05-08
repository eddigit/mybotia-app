"use client";

// V1 garde-fou Voice (Agent 4 — 2026-05-08).
// Permet à n'importe quel écran (typiquement /conversations) de publier le
// contexte conversation actif (conversationId / clientRef / projectRef) afin
// que VoicePanel (rendu dans ContextRail au niveau AppShell) sache de qui on
// parle quand on prend le micro.
//
// Sans ce contexte, VoicePanel s'ouvrait à blanc — Léa n'avait aucun signal
// métier et répondait "comme dans le vide".

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export interface VoiceConvContextValue {
  conversationId: string | null;
  clientRef: string | null;
  projectRef: string | null;
  channel: string | null;
  setVoiceConvContext: (
    next: {
      conversationId?: string | null;
      clientRef?: string | null;
      projectRef?: string | null;
      channel?: string | null;
    } | null
  ) => void;
}

const noopCtx: VoiceConvContextValue = {
  conversationId: null,
  clientRef: null,
  projectRef: null,
  channel: null,
  setVoiceConvContext: () => {},
};

const VoiceConvContext = createContext<VoiceConvContextValue>(noopCtx);

export function VoiceConvProvider({ children }: { children: ReactNode }) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [clientRef, setClientRef] = useState<string | null>(null);
  const [projectRef, setProjectRef] = useState<string | null>(null);
  const [channel, setChannel] = useState<string | null>(null);

  const setVoiceConvContext = useCallback<
    VoiceConvContextValue["setVoiceConvContext"]
  >((next) => {
    if (!next) {
      setConversationId(null);
      setClientRef(null);
      setProjectRef(null);
      setChannel(null);
      return;
    }
    if ("conversationId" in next) setConversationId(next.conversationId ?? null);
    if ("clientRef" in next) setClientRef(next.clientRef ?? null);
    if ("projectRef" in next) setProjectRef(next.projectRef ?? null);
    if ("channel" in next) setChannel(next.channel ?? null);
  }, []);

  return (
    <VoiceConvContext.Provider
      value={{
        conversationId,
        clientRef,
        projectRef,
        channel,
        setVoiceConvContext,
      }}
    >
      {children}
    </VoiceConvContext.Provider>
  );
}

export function useVoiceConvContext(): VoiceConvContextValue {
  return useContext(VoiceConvContext);
}
