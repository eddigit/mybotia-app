"use client";

import { useState } from "react";
import { Send, Paperclip, Mic, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function MessageComposer({ agentName }: { agentName: string }) {
  const [message, setMessage] = useState("");

  return (
    <div className="px-4 py-3 border-t border-border-subtle">
      <div className="flex items-end gap-2">
        <div className="flex-1 flex items-end gap-2 px-4 py-3 rounded-xl bg-surface-2 border border-border-subtle focus-within:border-accent-primary/30 focus-within:ring-1 focus-within:ring-accent-primary/10 transition-all">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`Ecrire a ${agentName}...`}
            className="flex-1 bg-transparent outline-none text-sm text-text-primary placeholder:text-text-muted resize-none max-h-32"
            rows={1}
          />
          <div className="flex items-center gap-1 shrink-0">
            <button className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-white/[0.05] transition-colors">
              <Paperclip className="w-4 h-4" />
            </button>
            <button className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-white/[0.05] transition-colors">
              <Mic className="w-4 h-4" />
            </button>
            <button className="p-1.5 rounded-md text-accent-primary/50 hover:text-accent-glow hover:bg-accent-primary/10 transition-colors">
              <Sparkles className="w-4 h-4" />
            </button>
          </div>
        </div>
        <button
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-xl transition-all shrink-0",
            message.trim()
              ? "bg-accent-primary text-white shadow-lg shadow-accent-primary/20"
              : "bg-surface-3 text-text-muted"
          )}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
