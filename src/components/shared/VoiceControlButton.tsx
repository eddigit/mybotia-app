"use client";

import { useState } from "react";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function VoiceControlButton({
  agentName,
  compact = false,
}: {
  agentName: string;
  compact?: boolean;
}) {
  const [state, setState] = useState<'idle' | 'listening' | 'speaking'>('idle');

  const toggle = () => {
    setState(prev =>
      prev === 'idle' ? 'listening' :
      prev === 'listening' ? 'speaking' : 'idle'
    );
  };

  if (compact) {
    return (
      <button
        onClick={toggle}
        className={cn(
          "flex items-center justify-center w-9 h-9 rounded-lg border transition-all",
          state === 'idle' && "bg-surface-3 border-border-subtle text-text-muted hover:text-text-primary",
          state === 'listening' && "bg-cyan-400/10 border-cyan-400/30 text-cyan-400 animate-pulse-glow",
          state === 'speaking' && "bg-violet-400/10 border-violet-400/30 text-violet-400 animate-pulse-glow",
        )}
      >
        {state === 'idle' && <Mic className="w-4 h-4" />}
        {state === 'listening' && <Mic className="w-4 h-4" />}
        {state === 'speaking' && <Volume2 className="w-4 h-4" />}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all",
        state === 'idle' && "bg-surface-3 border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-default",
        state === 'listening' && "bg-cyan-400/10 border-cyan-400/30 text-cyan-400",
        state === 'speaking' && "bg-violet-400/10 border-violet-400/30 text-violet-400",
      )}
    >
      {state === 'idle' && <><MicOff className="w-3.5 h-3.5" /> Activer la voix</>}
      {state === 'listening' && <><Mic className="w-3.5 h-3.5 animate-pulse-glow" /> {agentName} ecoute...</>}
      {state === 'speaking' && <><Volume2 className="w-3.5 h-3.5 animate-pulse-glow" /> {agentName} parle...</>}
    </button>
  );
}
