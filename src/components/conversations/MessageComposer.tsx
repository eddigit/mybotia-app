"use client";

import { useState } from "react";
import { Send, Paperclip, Mic, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function MessageComposer({ agentName }: { agentName: string }) {
  const [message, setMessage] = useState("");

  return (
    <div className="px-5 py-4 border-t border-white/[0.04] bg-surface-0/50">
      <div className="flex items-end gap-3">
        <div className="flex-1 flex items-end gap-2 px-4 py-3 bg-surface-2 border-b-2 border-white/[0.06] focus-within:border-accent-primary/40 transition-all">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`Ecrire a ${agentName}...`}
            className="flex-1 bg-transparent outline-none text-sm text-text-primary placeholder:text-text-muted resize-none max-h-32"
            rows={1}
          />
          <div className="flex items-center gap-1 shrink-0">
            <button className="p-1.5 text-text-muted hover:text-text-primary transition-colors">
              <Paperclip className="w-4 h-4" />
            </button>
            <button className="p-1.5 text-text-muted hover:text-text-primary transition-colors">
              <Mic className="w-4 h-4" />
            </button>
            <button className="p-1.5 text-accent-primary/40 hover:text-accent-glow transition-colors">
              <Zap className="w-4 h-4" />
            </button>
          </div>
        </div>
        <button
          className={cn(
            "flex items-center justify-center w-10 h-10 transition-all shrink-0",
            message.trim()
              ? "bg-accent-primary text-white"
              : "bg-surface-3 text-text-muted"
          )}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
