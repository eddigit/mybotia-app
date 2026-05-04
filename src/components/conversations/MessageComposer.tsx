"use client";

import { useState, useRef } from "react";
import { Send, Loader2, Brain, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export type ModelTier = "fast" | "deep";

export function MessageComposer({
  agentName,
  onSend,
  disabled,
}: {
  agentName: string;
  /**
   * Appele a l'envoi. modelTier vaut "deep" si l'utilisateur a active le mode Premium
   * (toggle Brain) — sinon "fast" (mode Standard).
   * Slash commands acceptés en alias caché interne : /opus, /premium, /reflechis, /deep.
   */
  onSend: (text: string, modelTier: ModelTier) => void;
  disabled?: boolean;
}) {
  const [message, setMessage] = useState("");
  const [deepMode, setDeepMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit() {
    let text = message.trim();
    if (!text || disabled) return;

    // Slash command (alias caché interne) : force le mode Premium pour ce message.
    let tier: ModelTier = deepMode ? "deep" : "fast";
    const slashMatch = text.match(/^\/(premium|opus|reflechis|reflechi|deep)\s+/i);
    if (slashMatch) {
      tier = "deep";
      text = text.slice(slashMatch[0].length).trim();
      if (!text) return;
    }

    onSend(text, tier);
    setMessage("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setMessage(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 128) + "px";
  }

  return (
    <div className="px-5 py-4 border-t border-border-subtle bg-surface-0/50 shrink-0">
      <div className="flex items-end gap-3">
        <div className="flex-1 flex flex-col gap-2 px-4 py-3 bg-surface-2 border-b-2 border-border-subtle focus-within:border-accent-primary/40 transition-all">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={`Ecrire a ${agentName}...`}
            className="flex-1 bg-transparent outline-none text-sm text-text-primary placeholder:text-text-muted resize-none max-h-32"
            rows={1}
            disabled={disabled}
          />
          {/* Toggle mode Premium (deep) — slash commands restent acceptés en alias interne */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setDeepMode((v) => !v)}
              disabled={disabled}
              title={
                deepMode
                  ? "Mode Premium actif. Plus lent, plus profond. Cliquer pour revenir au mode Standard."
                  : "Activer le mode Premium. Pour analyses longues, strategies, redaction nuancee."
              }
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold uppercase tracking-tight rounded transition-all",
                deepMode
                  ? "bg-accent-primary/15 text-accent-glow border border-accent-primary/30"
                  : "text-text-muted hover:text-text-secondary hover:bg-surface-3/50"
              )}
            >
              {deepMode ? (
                <>
                  <Brain className="w-3 h-3" />
                  Premium
                </>
              ) : (
                <>
                  <Zap className="w-3 h-3" />
                  Standard
                </>
              )}
            </button>
            <span className="text-[10px] text-text-muted/70 italic">
              {deepMode
                ? "Mode Premium — plus lent, plus profond"
                : "Mode Standard — rapide"}
            </span>
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!message.trim() || disabled}
          className={cn(
            "flex items-center justify-center w-10 h-10 transition-all shrink-0",
            message.trim() && !disabled
              ? "bg-accent-primary text-white"
              : "bg-surface-3 text-text-muted"
          )}
        >
          {disabled ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}
