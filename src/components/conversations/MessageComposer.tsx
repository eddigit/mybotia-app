"use client";

import { useState, useRef } from "react";
import { Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function MessageComposer({
  agentName,
  onSend,
  disabled,
}: {
  agentName: string;
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit() {
    const text = message.trim();
    if (!text || disabled) return;
    onSend(text);
    setMessage("");
    // Reset textarea height
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
    // Auto-resize
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 128) + "px";
  }

  return (
    <div className="px-5 py-4 border-t border-border-subtle bg-surface-0/50 shrink-0">
      <div className="flex items-end gap-3">
        <div className="flex-1 flex items-end gap-2 px-4 py-3 bg-surface-2 border-b-2 border-border-subtle focus-within:border-accent-primary/40 transition-all">
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
