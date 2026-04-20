"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  BarChart3,
  FolderKanban,
  Bot,
  CheckSquare,
  LayoutDashboard,
  MessagesSquare,
  FileText,
  Settings,
  ArrowRight,
  X,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClients, useProjects, useAgents, useTasks } from "@/hooks/use-api";
import type { Client, Project, Agent } from "@/types";
import type { TaskItem } from "@/hooks/use-api";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  href: string;
  category: string;
}

/* ------------------------------------------------------------------ */
/*  Navigation commands (always visible)                               */
/* ------------------------------------------------------------------ */

const NAV_COMMANDS: SearchResult[] = [
  { id: "nav-home", label: "Command Center", sublabel: "Tableau de bord", icon: <LayoutDashboard className="w-4 h-4" />, href: "/", category: "Navigation" },
  { id: "nav-crm", label: "CRM / Activite", sublabel: "Clients et pipeline", icon: <BarChart3 className="w-4 h-4" />, href: "/crm", category: "Navigation" },
  { id: "nav-conversations", label: "Conversations", sublabel: "Messages agents", icon: <MessagesSquare className="w-4 h-4" />, href: "/conversations", category: "Navigation" },
  { id: "nav-tasks", label: "Taches", sublabel: "Suivi des taches", icon: <CheckSquare className="w-4 h-4" />, href: "/tasks", category: "Navigation" },
  { id: "nav-agents", label: "Agents", sublabel: "Statut des agents IA", icon: <Bot className="w-4 h-4" />, href: "/agents", category: "Navigation" },
  { id: "nav-documents", label: "Documents", sublabel: "Factures et devis", icon: <FileText className="w-4 h-4" />, href: "/documents", category: "Navigation" },
  { id: "nav-settings", label: "Parametres", sublabel: "Configuration", icon: <Settings className="w-4 h-4" />, href: "/settings", category: "Navigation" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function matchScore(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.includes(q)) return 60;
  // fuzzy: all chars in order
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length ? 30 : 0;
}

function buildResults(
  query: string,
  clients: Client[],
  projects: Project[],
  agents: Agent[],
  tasks: TaskItem[]
): SearchResult[] {
  if (!query.trim()) return NAV_COMMANDS;

  const all: (SearchResult & { score: number })[] = [];

  // Search clients
  for (const c of clients) {
    const s = Math.max(matchScore(query, c.name), matchScore(query, c.company), matchScore(query, c.email || ""));
    if (s > 0) all.push({ id: `client-${c.id}`, label: c.name, sublabel: c.town || c.email, icon: <Users className="w-4 h-4" />, href: `/crm/${c.id}`, category: "Clients", score: s });
  }

  // Search projects
  for (const p of projects) {
    const s = Math.max(matchScore(query, p.name), matchScore(query, p.ref || ""));
    if (s > 0) all.push({ id: `project-${p.id}`, label: p.name, sublabel: p.ref || p.clientName, icon: <FolderKanban className="w-4 h-4" />, href: `/crm`, category: "Projets", score: s });
  }

  // Search agents
  for (const a of agents) {
    const s = Math.max(matchScore(query, a.name), matchScore(query, a.role));
    if (s > 0) all.push({ id: `agent-${a.id}`, label: a.name, sublabel: a.role, icon: <Bot className="w-4 h-4" />, href: `/agents`, category: "Agents", score: s });
  }

  // Search tasks
  for (const t of tasks) {
    const s = Math.max(matchScore(query, t.title), matchScore(query, t.projectName || ""));
    if (s > 0) all.push({ id: `task-${t.id}`, label: t.title, sublabel: t.projectName, icon: <CheckSquare className="w-4 h-4" />, href: `/tasks`, category: "Taches", score: s });
  }

  // Nav commands also searchable
  for (const n of NAV_COMMANDS) {
    const s = Math.max(matchScore(query, n.label), matchScore(query, n.sublabel || ""));
    if (s > 0) all.push({ ...n, score: s });
  }

  // sort by score desc, limit 12
  all.sort((a, b) => b.score - a.score);
  return all.slice(0, 12);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { data: clients } = useClients();
  const { data: projects } = useProjects();
  const { data: agents } = useAgents();
  const { data: tasks } = useTasks();

  const results = useMemo(
    () => buildResults(query, clients, projects, agents, tasks),
    [query, clients, projects, agents, tasks]
  );

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Clamp selection
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const navigate = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      navigate(results[selectedIndex].href);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  if (!open) return null;

  // Group results by category
  const grouped: { category: string; items: SearchResult[] }[] = [];
  const catMap = new Map<string, SearchResult[]>();
  for (const r of results) {
    if (!catMap.has(r.category)) catMap.set(r.category, []);
    catMap.get(r.category)!.push(r);
  }
  for (const [category, items] of catMap) {
    grouped.push({ category, items });
  }

  let globalIdx = -1;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="fixed inset-0 z-[101] flex items-start justify-center pt-[15vh] px-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-2xl bg-surface-1 border border-border-default rounded-xl shadow-2xl shadow-black/40 overflow-hidden"
          onKeyDown={handleKeyDown}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border-subtle">
            <Search className="w-5 h-5 text-text-muted shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher clients, projets, agents, taches..."
              className="flex-1 bg-transparent text-base text-text-primary placeholder:text-text-muted focus:outline-none font-body"
            />
            <button
              onClick={onClose}
              className="flex items-center justify-center w-7 h-7 rounded-md bg-surface-3 text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2">
            {results.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-text-muted text-sm">Aucun resultat pour &ldquo;{query}&rdquo;</p>
              </div>
            ) : (
              grouped.map((group) => (
                <div key={group.category}>
                  <div className="px-5 pt-3 pb-1">
                    <span className="micro-label text-text-muted">{group.category}</span>
                  </div>
                  {group.items.map((item) => {
                    globalIdx++;
                    const idx = globalIdx;
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={item.id}
                        data-index={idx}
                        onClick={() => navigate(item.href)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={cn(
                          "w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors",
                          isSelected
                            ? "bg-accent-primary/10 text-accent-glow"
                            : "text-text-secondary hover:bg-surface-3/50"
                        )}
                      >
                        <span className={cn("shrink-0", isSelected ? "text-accent-glow" : "text-text-muted")}>
                          {item.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold truncate block">{item.label}</span>
                          {item.sublabel && (
                            <span className="text-[11px] text-text-muted truncate block">{item.sublabel}</span>
                          )}
                        </div>
                        {isSelected && <ArrowRight className="w-3.5 h-3.5 shrink-0 text-accent-glow" />}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer hints */}
          <div className="flex items-center gap-4 px-5 py-3 border-t border-border-subtle bg-surface-0/50">
            <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
              <kbd className="px-1.5 py-0.5 bg-surface-3 rounded border border-border-subtle font-mono font-bold">↑↓</kbd>
              <span>naviguer</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
              <kbd className="px-1.5 py-0.5 bg-surface-3 rounded border border-border-subtle font-mono font-bold">↵</kbd>
              <span>ouvrir</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
              <kbd className="px-1.5 py-0.5 bg-surface-3 rounded border border-border-subtle font-mono font-bold">esc</kbd>
              <span>fermer</span>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-accent-glow" />
              <span className="text-[10px] text-text-muted font-bold">MyBotIA</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
