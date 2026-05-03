"use client";

import { useEffect, useRef, useState } from "react";

type Msg = {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  ts: number;
};

export default function RaphaelInlineChat({ contextHint }: { contextHint?: string }) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "sys",
      role: "assistant",
      content:
        "Bonjour Madame. Je suis ici pour vous aider sur vos sociétés, votre Drive, vos factures et toute question juridique ou rédactionnelle. Que puis-je faire ?",
      ts: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    function onSuggest(e: Event) {
      const ce = e as CustomEvent<{ prompt: string }>;
      if (ce.detail?.prompt) {
        setInput(ce.detail.prompt);
        taRef.current?.focus();
      }
    }
    window.addEventListener("raphael-suggest", onSuggest as EventListener);
    return () => window.removeEventListener("raphael-suggest", onSuggest as EventListener);
  }, []);

  async function send() {
    const text = input.trim();
    if (!text || pending) return;

    const userMsg: Msg = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      ts: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setPending(true);

    try {
      const res = await fetch("/api/conversations/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          agent_id: "raphael",
          message: text,
          context_hint: contextHint,
          model_tier: "fast",
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let assistantText = "";
      const assistantId = `a-${Date.now()}`;

      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "…", ts: Date.now() },
      ]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data:")) {
              const payload = line.slice(5).trim();
              if (payload === "[DONE]") continue;
              try {
                const j = JSON.parse(payload);
                if (j.delta) {
                  assistantText += j.delta;
                } else if (j.content) {
                  assistantText = j.content;
                }
                const safe = assistantText;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: safe } : m))
                );
              } catch { /* skip */ }
            }
          }
        }
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: `Erreur côté Raphaël : ${String(e)}`,
          ts: Date.now(),
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex flex-col h-full bg-slate-900/40">
      <header className="px-4 py-3 border-b border-slate-700/40 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-300 text-sm font-medium">
          R
        </div>
        <div>
          <div className="text-sm font-medium text-slate-100">Raphaël</div>
          <div className="text-xs text-slate-400">CMB Conseil · en ligne</div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap " +
                (m.role === "user"
                  ? "bg-blue-600/30 text-blue-100"
                  : "bg-slate-800/60 text-slate-100")
              }
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-700/40 p-3">
        <textarea
          ref={taRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder={pending ? "Raphaël travaille…" : "Écrivez à Raphaël (Entrée = envoyer)"}
          disabled={pending}
          rows={3}
          className="w-full bg-slate-800/60 text-slate-100 text-sm rounded-md p-2 border border-slate-700/40 focus:outline-none focus:border-blue-500/60 resize-none"
        />
        <div className="flex justify-between items-center mt-2 text-xs text-slate-500">
          <span>Entrée = envoyer · Shift+Entrée = retour ligne</span>
          <button
            onClick={send}
            disabled={pending || !input.trim()}
            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
          >
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}
