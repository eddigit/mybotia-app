"use client";

import { useState } from "react";
import {
  Mic,
  MicOff,
  Zap,
  MoreVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types";
import { AgentAvatar } from "@/components/shared/AgentAvatar";
import { VoicePanel } from "@/components/voice/VoicePanel";
import { getVoiceConfig } from "@/lib/voice-config";

interface ContextRailProps {
  onClose: () => void;
  agents: Agent[];
}

export function ContextRail({ onClose, agents }: ContextRailProps) {
  const [voiceOpen, setVoiceOpen] = useState(false);
  const activeAgent = agents[0] ?? null;
  const voiceConfig = activeAgent ? getVoiceConfig(activeAgent.id) : null;

  return (
    <aside className="w-[320px] h-full bg-surface-1/90 backdrop-blur-xl flex flex-col shrink-0 animate-slide-in-right shadow-[-20px_0_40px_rgba(99,102,241,0.03)]">
      {/* Header */}
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-accent-glow font-extrabold font-headline text-sm">Voice Panel MBIA</h3>
            <p className="micro-label text-text-muted mt-0.5">Echange vocal avec ton agent</p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Agent Presence Widget — centered, Jarvis style */}
      <div className="px-6 pb-6 flex flex-col items-center text-center border-b border-border-subtle">
        {activeAgent ? (
          <>
            <div className="relative mb-4">
              {/* Outer ring */}
              <div className="w-20 h-20 rounded-full bg-accent-primary/10 flex items-center justify-center border border-accent-primary/20">
                {/* Inner core */}
                <div className="w-14 h-14 rounded-full bg-accent-primary flex items-center justify-center animate-glow-breathe overflow-hidden">
                  <AgentAvatar agentId={activeAgent.id} size={56} className="rounded-full" />
                </div>
              </div>
              {/* Pulse ring */}
              <div className="absolute inset-0 rounded-full border border-accent-primary/20 animate-pulse-ring" />
            </div>
            <h3 className="text-sm font-bold text-text-primary font-headline">{activeAgent.name} est en ligne</h3>
            <p className="text-xs text-text-secondary mt-1 mb-3">{activeAgent.role}</p>
          </>
        ) : (
          <p className="text-xs text-text-muted mb-3">Aucun agent disponible</p>
        )}

        {/* Voice toggle */}
        <div className="flex items-center gap-2 w-full">
          {voiceConfig ? (
            <button
              onClick={() => setVoiceOpen(!voiceOpen)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 border text-xs font-bold transition-all",
                voiceOpen
                  ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/15"
                  : "bg-accent-primary/10 border-accent-primary/20 text-accent-glow hover:bg-accent-primary/15"
              )}
            >
              {voiceOpen ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              {voiceOpen ? "Fermer" : "Parler"}
            </button>
          ) : (
            <button
              disabled
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-surface-3/50 border border-border-subtle text-text-muted text-xs font-bold cursor-not-allowed"
            >
              <MicOff className="w-3.5 h-3.5" />
              Voix indisponible
            </button>
          )}
        </div>

        {/* Accuracy indicator */}
        <div className="mt-3 flex items-center gap-2 py-1.5 px-3 bg-surface-2 rounded-full text-[10px] font-bold text-accent-glow">
          <Zap className="w-3 h-3" />
          {agents.length} AGENT{agents.length > 1 ? 'S' : ''} ACTIF{agents.length > 1 ? 'S' : ''}
        </div>
      </div>

      {/* Voice Panel */}
      <div className="flex-1 overflow-y-auto">
        {voiceOpen && activeAgent && voiceConfig ? (
          <VoicePanel
            agentName={activeAgent.name}
            voiceWsUrl={voiceConfig.wsUrl}
            wakeWord={voiceConfig.wakeWord}
          />
        ) : (
          <div className="p-6">
            <p className="text-xs text-text-muted text-center py-8">
              Clique sur <span className="text-accent-glow font-bold">Parler</span> pour demarrer la conversation vocale.
            </p>
          </div>
        )}
      </div>

      {/* Bottom latency indicator */}
      <div className="p-4 bg-surface-1/50">
        <div className="flex items-center gap-4 p-3 border border-accent-primary/15 rounded-lg">
          <Zap className="w-4 h-4 text-accent-glow" />
          <div>
            <div className="micro-label text-text-muted">Latence</div>
            <div className="text-sm font-bold text-text-primary">
              &lt; 3s <span className="text-emerald-400 text-xs">Stable</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
