"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  MessagesSquare,
  Bot,
  FolderOpen,
  Folder,
  FolderPlus,
  ChevronDown,
  ChevronRight,
  Plus,
  Send,
  Phone,
  Globe,
  MessageSquare,
  Brain,
  MoreVertical,
  Trash2,
  Edit2,
  X,
} from "lucide-react";
import { ConversationThread } from "@/components/conversations/ConversationThread";
import {
  useConversations,
  useMessages,
  useProjects,
  useAgents,
  useFolders,
  deleteConversationApi,
  moveConversationApi,
  renameConversationApi,
  createFolderApi,
  renameFolderApi,
  deleteFolderApi,
  type ConversationItem,
  type ConversationFolderItem,
  type ChatMessage,
} from "@/hooks/use-api";
import {
  FormModal,
  FormField,
  selectClass,
  btnPrimary,
  btnSecondary,
} from "@/components/shared/FormModal";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";
import type { Project } from "@/types";

// AGENTS loaded dynamically from /api/agents (tenant-filtered)

const channelIcons: Record<string, typeof MessageSquare> = {
  whatsapp: Phone,
  telegram: Send,
  webchat: Globe,
  chat: Globe,
  direct: Bot,
  project: FolderOpen,
  crm_widget: Bot,
  unknown: MessageSquare,
};

// Libelle humain pour chaque source de conversation (UI front-safe).
const channelLabels: Record<string, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  webchat: "App MyBotIA",
  chat: "App MyBotIA",
  direct: "Direct",
  project: "Session projet",
  crm_widget: "CRM MyBotIA",
  unknown: "Autre",
};

function channelLabel(channel: string): string {
  return channelLabels[channel] || channel || "Autre";
}

// Helper: deterministic session ID for a project conversation
function projectSessionId(projectId: string, agentId: string): string {
  return `project-${projectId}-${agentId}`;
}

export default function ConversationsPage() {
  const {
    data: conversations,
    loading: convsLoading,
    refetch: refetchConvs,
  } = useConversations();
  const { data: projects } = useProjects();
  const { data: agents } = useAgents();
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [tempConv, setTempConv] = useState<ConversationItem | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set(["_general"])
  );
  const { data: folders, refetch: refetchFolders } = useFolders();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Fermer le menu au click outside
  useEffect(() => {
    if (!openMenuId) return;
    function onDocClick() {
      setOpenMenuId(null);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [openMenuId]);

  const activeConv =
    conversations.find((c) => c.id === activeConvId) ||
    (tempConv?.id === activeConvId ? tempConv : null);

  const {
    data: sessionMessages,
    loading: msgsLoading,
  } = useMessages(activeConvId);

  const displayMessages = activeConv
    ? [
        ...sessionMessages,
        ...localMessages.filter((m) => m.id.startsWith("local-")),
      ]
    : localMessages;

  // Group conversations : folder > project > general (une conv appartient a
  // un seul groupe, le folder prime s'il est defini).
  const { folderGroups, projectGroups, generalConvs } = useMemo(() => {
    const folderMap = new Map<string, ConversationItem[]>();
    const projectMap = new Map<
      string,
      { project: Project | null; convs: ConversationItem[] }
    >();
    const general: ConversationItem[] = [];

    const allConvs = tempConv ? [...conversations, tempConv] : conversations;

    for (const conv of allConvs) {
      if (conv.folderId) {
        if (!folderMap.has(conv.folderId)) folderMap.set(conv.folderId, []);
        folderMap.get(conv.folderId)!.push(conv);
      } else if (conv.projectId) {
        const proj = projects.find((p) => p.id === conv.projectId) || null;
        if (!projectMap.has(conv.projectId)) {
          projectMap.set(conv.projectId, { project: proj, convs: [] });
        }
        projectMap.get(conv.projectId)!.convs.push(conv);
      } else {
        general.push(conv);
      }
    }

    return {
      folderGroups: folderMap,
      projectGroups: Array.from(projectMap.entries()).sort((a, b) => {
        const latestA = Math.max(
          ...a[1].convs.map((c) => new Date(c.updatedAt).getTime())
        );
        const latestB = Math.max(
          ...b[1].convs.map((c) => new Date(c.updatedAt).getTime())
        );
        return latestB - latestA;
      }),
      generalConvs: general,
    };
  }, [conversations, projects, tempConv]);

  const handleSelectConv = useCallback((id: string) => {
    setActiveConvId(id);
    setLocalMessages([]);
  }, []);

  function toggleProject(id: string) {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleFolder(id: string) {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreateFolder() {
    const name = window.prompt("Nom du nouveau dossier :");
    if (!name || !name.trim()) return;
    try {
      const f = await createFolderApi(name.trim());
      refetchFolders();
      setExpandedFolders((prev) => new Set([...prev, f.id]));
    } catch (e) {
      window.alert("Erreur creation dossier : " + (e as Error).message);
    }
  }

  async function handleRenameFolder(id: string, current: string) {
    const name = window.prompt("Renommer le dossier :", current);
    if (!name || !name.trim() || name === current) return;
    try {
      await renameFolderApi(id, name.trim());
      refetchFolders();
    } catch (e) {
      window.alert("Erreur : " + (e as Error).message);
    }
  }

  async function handleDeleteFolder(id: string, name: string) {
    const ok = window.confirm(
      `Supprimer le dossier "${name}" ?\n\nLes conversations qu'il contient ne sont pas supprimees — elles reviennent dans "Conversations generales".`
    );
    if (!ok) return;
    try {
      await deleteFolderApi(id);
      refetchFolders();
      refetchConvs();
    } catch (e) {
      window.alert("Erreur : " + (e as Error).message);
    }
  }

  async function handleDeleteConv(id: string, title: string) {
    const ok = window.confirm(
      `Supprimer la conversation "${title || "Sans titre"}" ?\n\nElle disparait de ta liste. L'historique reste archive cote serveur.`
    );
    if (!ok) return;
    try {
      await deleteConversationApi(id);
      refetchConvs();
      if (activeConvId === id) setActiveConvId(null);
    } catch (e) {
      window.alert("Erreur suppression : " + (e as Error).message);
    }
  }

  async function handleMoveConv(id: string, folderId: string | null) {
    try {
      await moveConversationApi(id, folderId);
      refetchConvs();
      refetchFolders();
    } catch (e) {
      window.alert("Erreur deplacement : " + (e as Error).message);
    }
  }

  async function handleRenameConv(id: string, current: string) {
    const title = window.prompt("Titre de la conversation :", current || "");
    if (title === null) return;
    const trimmed = title.trim();
    if (!trimmed || trimmed === current) return;
    try {
      await renameConversationApi(id, trimmed);
      refetchConvs();
    } catch (e) {
      window.alert("Erreur renommage : " + (e as Error).message);
    }
  }

  async function handleSend(text: string, modelTier: "fast" | "deep" = "fast") {
    if (!activeConv) return;

    const userMsg: ChatMessage = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, userMsg]);
    setSending(true);
    setStatusText("");

    try {
      const project = activeConv.projectId
        ? projects.find((p) => p.id === activeConv.projectId)
        : null;

      const payload: Record<string, string | undefined> = {
        agentId: activeConv.agentId,
        message: text,
        modelTier,
        sessionId: activeConvId?.startsWith("new-")
          ? undefined
          : activeConvId || undefined,
      };

      if (project && activeConv.projectId) {
        payload.projectId = activeConv.projectId;
        payload.projectRef = project.ref;
        payload.projectName = project.name;
        payload.clientName = project.clientName;
        payload.projectDescription = project.description;
      }

      const res = await fetch("/api/conversations/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok || !res.body) {
        const fallback = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await fallback.json();
        if (data.error) {
          setLocalMessages((prev) => [...prev, { id: `local-error-${Date.now()}`, role: "system", content: `Erreur: ${data.error}`, timestamp: new Date().toISOString() }]);
        } else {
          setLocalMessages((prev) => [...prev, { id: `local-agent-${Date.now()}`, role: "assistant", content: data.content, timestamp: new Date().toISOString() }]);
        }
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let newSessionId = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") continue;
          try {
            const evt = JSON.parse(raw);
            if (evt.status) setStatusText(evt.status);
            if (evt.delta) fullContent += evt.delta;
            if (evt.done) {
              newSessionId = evt.session_id || "";
              if (evt.result && !fullContent) fullContent = evt.result;
            }
          } catch { /* skip */ }
        }
      }

      if (fullContent) {
        setLocalMessages((prev) => [...prev, { id: `local-agent-${Date.now()}`, role: "assistant", content: fullContent, timestamp: new Date().toISOString() }]);
      }
      if (newSessionId && activeConvId?.startsWith("new-")) {
        setTempConv((prev) =>
          prev && prev.id === activeConvId
            ? { ...prev, id: newSessionId, sessionId: newSessionId }
            : prev
        );
        setActiveConvId(newSessionId);
        refetchConvs();
      }
    } catch {
      setLocalMessages((prev) => [...prev, { id: `local-error-${Date.now()}`, role: "system", content: "Erreur de connexion", timestamp: new Date().toISOString() }]);
    } finally {
      setSending(false);
      setStatusText("");
    }
  }

  function startNewChat(agentId: string, projectId?: string) {
    const agent = (agents ?? []).find((a) => a.id === agentId);
    const project = projectId
      ? projects.find((p) => p.id === projectId)
      : null;

    // Session ID: deterministic for projects, unique for general
    const sessionId = project
      ? projectSessionId(project.id, agentId)
      : `new-${Date.now()}`;

    // Check if a conversation already exists for this project+agent
    const existing = conversations.find(
      (c) =>
        c.projectId === projectId &&
        c.agentId === agentId &&
        c.channel === "project"
    );

    if (existing) {
      // Just select it
      setActiveConvId(existing.id);
      setLocalMessages([]);
      setShowNewChat(false);
      return;
    }

    const newConv: ConversationItem = {
      id: sessionId,
      sessionId,
      agentId,
      agentName: agent?.name || agentId,
      key: `new:${agentId}`,
      channel: project ? "project" : "webchat",
      target: project ? `project-${projectId}-${agentId}` : "new",
      updatedAt: new Date().toISOString(),
      model: "",
      title: project
        ? project.name
        : `${agent?.name || agentId} — Nouvelle conversation`,
      projectId: project?.id,
      projectRef: project?.ref,
      projectName: project?.name,
    };

    setTempConv(newConv);
    setActiveConvId(sessionId);
    setLocalMessages([]);
    setShowNewChat(false);

    // Auto-expand the project group
    if (projectId) {
      setExpandedProjects((prev) => new Set([...prev, projectId]));
    }
  }

  if (convsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted micro-label">
            Chargement des conversations...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left panel — conversations grouped by project */}
      <div className="w-[340px] border-r border-border-subtle bg-surface-1/30 shrink-0 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border-subtle shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold font-headline text-text-primary">
              Conversations
            </h2>
            <button
              onClick={() => setShowNewChat(true)}
              className="flex items-center justify-center w-7 h-7 bg-accent-primary/10 text-accent-glow hover:bg-accent-primary/20 transition-all rounded-sm"
              title="Nouvelle conversation"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-text-muted">
            {conversations.length} conversations · {folders.length} dossiers ·{" "}
            {projectGroups.length} projets
          </p>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto">
          {(() => {
            const buildActions = (conv: ConversationItem): ConvRowActions => ({
              folders,
              isMenuOpen: openMenuId === conv.id,
              onMenuToggle: () =>
                setOpenMenuId((prev) => (prev === conv.id ? null : conv.id)),
              onDelete: () => handleDeleteConv(conv.id, conv.title),
              onRename: () => handleRenameConv(conv.id, conv.title),
              onMove: (folderId) => handleMoveConv(conv.id, folderId),
            });

            return (
              <>
                {/* Folders section header + create */}
                <div className="flex items-center justify-between px-5 py-2 border-b border-border-subtle">
                  <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">
                    Mes dossiers
                  </span>
                  <button
                    onClick={handleCreateFolder}
                    className="flex items-center gap-1 text-[10px] text-accent-glow hover:text-accent-primary transition-all"
                    title="Creer un dossier"
                  >
                    <FolderPlus className="w-3 h-3" /> Dossier
                  </button>
                </div>

                {folders.length === 0 && (
                  <div className="px-5 py-3 text-[10px] text-text-muted italic border-b border-border-subtle">
                    Aucun dossier. Cree-en un pour ranger tes conversations.
                  </div>
                )}

                {/* User folders */}
                {folders.map((f) => {
                  const convs = folderGroups.get(f.id) || [];
                  const expanded = expandedFolders.has(f.id);
                  return (
                    <div key={f.id}>
                      <div className="group flex items-center gap-2 px-5 py-3 bg-surface-2/50 border-b border-border-subtle hover:bg-surface-3/30 transition-all">
                        <button
                          onClick={() => toggleFolder(f.id)}
                          className="flex items-center gap-2 flex-1 min-w-0 text-left"
                        >
                          {expanded ? (
                            <ChevronDown className="w-3 h-3 text-text-muted shrink-0" />
                          ) : (
                            <ChevronRight className="w-3 h-3 text-text-muted shrink-0" />
                          )}
                          <Folder className="w-3.5 h-3.5 text-accent-glow shrink-0" />
                          <span className="text-[11px] font-bold text-text-primary truncate flex-1">
                            {f.name}
                          </span>
                          <span className="text-[10px] text-text-muted font-mono shrink-0">
                            {convs.length}
                          </span>
                        </button>
                        <button
                          onClick={() => handleRenameFolder(f.id, f.name)}
                          className="w-5 h-5 flex items-center justify-center text-text-muted hover:text-text-primary opacity-0 group-hover:opacity-100 transition-all"
                          title="Renommer"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteFolder(f.id, f.name)}
                          className="w-5 h-5 flex items-center justify-center text-text-muted hover:text-status-danger opacity-0 group-hover:opacity-100 transition-all"
                          title="Supprimer le dossier"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      {expanded &&
                        convs.map((conv) => (
                          <ConvRow
                            key={conv.id}
                            conv={conv}
                            isActive={conv.id === activeConvId}
                            onSelect={handleSelectConv}
                            indent
                            actions={buildActions(conv)}
                          />
                        ))}
                    </div>
                  );
                })}

                {/* Project groups */}
                {projectGroups.map(([projectId, { project, convs }]) => (
                  <div key={projectId}>
                    <button
                      onClick={() => toggleProject(projectId)}
                      className="w-full flex items-center gap-2 px-5 py-3 bg-surface-2/50 border-b border-border-subtle hover:bg-surface-3/30 transition-all"
                    >
                      {expandedProjects.has(projectId) ? (
                        <ChevronDown className="w-3 h-3 text-text-muted shrink-0" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-text-muted shrink-0" />
                      )}
                      <FolderOpen className="w-3.5 h-3.5 text-accent-glow shrink-0" />
                      <span className="text-[11px] font-bold text-text-primary truncate flex-1 text-left">
                        {project?.name || project?.ref || `Projet #${projectId}`}
                      </span>
                      <span className="text-[10px] text-text-muted font-mono shrink-0">
                        {convs.length}
                      </span>
                    </button>

                    {expandedProjects.has(projectId) &&
                      convs.map((conv) => (
                        <ConvRow
                          key={conv.id}
                          conv={conv}
                          isActive={conv.id === activeConvId}
                          onSelect={handleSelectConv}
                          indent
                          actions={buildActions(conv)}
                        />
                      ))}
                  </div>
                ))}

                {/* General conversations (no folder, no project) */}
                {generalConvs.length > 0 && (
                  <>
                    <button
                      onClick={() => toggleProject("_general")}
                      className="w-full flex items-center gap-2 px-5 py-3 bg-surface-2/50 border-b border-border-subtle hover:bg-surface-3/30 transition-all"
                    >
                      {expandedProjects.has("_general") ? (
                        <ChevronDown className="w-3 h-3 text-text-muted shrink-0" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-text-muted shrink-0" />
                      )}
                      <MessageSquare className="w-3.5 h-3.5 text-text-muted shrink-0" />
                      <span className="text-[11px] font-bold text-text-primary flex-1 text-left">
                        Conversations generales
                      </span>
                      <span className="text-[10px] text-text-muted font-mono shrink-0">
                        {generalConvs.length}
                      </span>
                    </button>

                    {expandedProjects.has("_general") &&
                      generalConvs.map((conv) => (
                        <ConvRow
                          key={conv.id}
                          conv={conv}
                          isActive={conv.id === activeConvId}
                          onSelect={handleSelectConv}
                          indent
                          actions={buildActions(conv)}
                        />
                      ))}
                  </>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* Thread — center */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {activeConv ? (
          <ConversationThread
            conversation={activeConv}
            messages={displayMessages}
            loading={msgsLoading}
            sending={sending}
            statusText={statusText}
            onSend={handleSend}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-sm">
              <MessagesSquare className="w-12 h-12 text-text-muted mx-auto mb-3" />
              <p className="text-sm text-text-secondary mb-2">
                Selectionnez une conversation ou{" "}
                <button
                  onClick={() => setShowNewChat(true)}
                  className="text-accent-glow hover:underline"
                >
                  demarrez-en une nouvelle
                </button>
              </p>
              <p className="text-[11px] text-text-muted">
                Les conversations par projet permettent a l'agent de garder la
                memoire metier de chaque dossier.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* New chat modal */}
      <FormModal
        open={showNewChat}
        onClose={() => setShowNewChat(false)}
        title="Nouvelle conversation"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const projectId = form.get("project") as string;
            startNewChat(
              form.get("agent") as string,
              projectId === "_none" ? undefined : projectId
            );
          }}
        >
          <FormField label="Projet">
            <select
              name="project"
              className={selectClass}
              defaultValue="_none"
            >
              <option value="_none">-- Conversation libre --</option>
              {projects
                .filter((p) => p.status === "active")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.ref ? `${p.ref} — ` : ""}
                    {p.name}
                    {p.clientName ? ` (${p.clientName})` : ""}
                  </option>
                ))}
            </select>
          </FormField>
          <FormField label="Agent">
            <select name="agent" className={selectClass} defaultValue="main">
              {(agents ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </FormField>
          <div className="flex items-center gap-2 p-3 bg-surface-2 border border-border-subtle mt-2 mb-4">
            <Brain className="w-4 h-4 text-accent-glow shrink-0" />
            <p className="text-[11px] text-text-secondary">
              L'agent garde sa memoire metier par projet. Chaque echange enrichit
              sa connaissance du dossier.
            </p>
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowNewChat(false)}
              className={btnSecondary}
            >
              Annuler
            </button>
            <button type="submit" className={btnPrimary}>
              Demarrer
            </button>
          </div>
        </form>
      </FormModal>
    </div>
  );
}

// ---- Conversation row component ----

interface ConvRowActions {
  folders: ConversationFolderItem[];
  isMenuOpen: boolean;
  onMenuToggle: () => void;
  onDelete: () => void;
  onRename: () => void;
  onMove: (folderId: string | null) => void;
}

function ConvRow({
  conv,
  isActive,
  onSelect,
  indent,
  actions,
}: {
  conv: ConversationItem;
  isActive: boolean;
  onSelect: (id: string) => void;
  indent?: boolean;
  actions?: ConvRowActions;
}) {
  const ChannelIcon = channelIcons[conv.channel] || MessageSquare;

  return (
    <div
      className={cn(
        "relative group w-full border-b border-border-subtle transition-all",
        indent ? "pl-10 pr-3" : "pl-5 pr-3",
        isActive
          ? "bg-accent-primary/5 border-l-2 border-l-accent-primary"
          : "hover:bg-surface-3/30 border-l-2 border-l-transparent"
      )}
    >
      <button
        onClick={() => onSelect(conv.id)}
        className="w-full text-left py-3 pr-6"
      >
        <div className="flex items-start gap-2.5">
          <div className="flex items-center justify-center w-7 h-7 bg-surface-3 shrink-0 mt-0.5 rounded-sm">
            <ChannelIcon className="w-3 h-3 text-text-muted" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <span className="text-[12px] font-semibold text-text-primary truncate">
                {conv.title || "Nouvelle conversation"}
              </span>
              <span className="text-[9px] text-text-muted font-mono shrink-0">
                {formatRelativeTime(conv.updatedAt)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="text-accent-glow font-medium truncate">
                {conv.agentName}
              </span>
              <span className="text-text-muted">·</span>
              <span className="text-text-muted truncate">
                {channelLabel(conv.channel)}
              </span>
            </div>
          </div>
        </div>
      </button>

      {actions && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              actions.onMenuToggle();
            }}
            className={cn(
              "absolute top-3 right-1 w-6 h-6 flex items-center justify-center rounded-sm text-text-muted hover:text-text-primary hover:bg-surface-3/60 transition-all",
              actions.isMenuOpen
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100 focus:opacity-100"
            )}
            title="Options"
            aria-label="Options conversation"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {actions.isMenuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-1 top-9 z-20 w-56 bg-surface-1 border border-border-default rounded-sm shadow-lg py-1 text-[12px]"
            >
              <button
                type="button"
                onClick={() => {
                  actions.onRename();
                  actions.onMenuToggle();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-3/50 text-text-primary"
              >
                <Edit2 className="w-3 h-3" /> Renommer
              </button>

              <div className="px-3 py-1.5 text-[10px] uppercase text-text-muted tracking-wide border-t border-border-subtle mt-1">
                Deplacer vers
              </div>
              <button
                type="button"
                onClick={() => {
                  actions.onMove(null);
                  actions.onMenuToggle();
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-surface-3/50",
                  !conv.folderId ? "text-accent-glow" : "text-text-secondary"
                )}
              >
                <MessageSquare className="w-3 h-3" /> Conversations generales
              </button>
              {actions.folders.length === 0 && (
                <div className="px-3 py-1.5 text-[10px] text-text-muted italic">
                  (aucun dossier — cree-en un avec + Dossier)
                </div>
              )}
              {actions.folders.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    actions.onMove(f.id);
                    actions.onMenuToggle();
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-surface-3/50",
                    conv.folderId === f.id
                      ? "text-accent-glow"
                      : "text-text-secondary"
                  )}
                >
                  <Folder className="w-3 h-3" />
                  <span className="truncate flex-1">{f.name}</span>
                </button>
              ))}

              <div className="border-t border-border-subtle mt-1">
                <button
                  type="button"
                  onClick={() => {
                    actions.onDelete();
                    actions.onMenuToggle();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-status-danger/10 text-status-danger"
                >
                  <Trash2 className="w-3 h-3" /> Supprimer
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
