"use client";

import { useEffect, useState, useCallback, useRef, FormEvent, KeyboardEvent } from "react";
import {
  FolderClosed,
  FolderOpen,
  Plus,
  MessageSquare,
  Send,
  Loader2,
  X,
  Sparkles,
  MoreHorizontal,
  Check,
  Copy,
  CheckCheck,
  ChevronRight,
  ChevronDown,
  Trash2,
  Archive,
  Pencil,
} from "lucide-react";
import {
  v4Api,
  FolderApi,
  ConversationApi,
  MessageApi,
} from "@/lib/v4/client-api";
import { useAuth } from "@/contexts/auth-context";
import { useVoiceConvContext } from "@/contexts/voice-context";
import { AgentAvatar } from "@/components/shared/AgentAvatar";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { UserAvatarV4 } from "./UserAvatarV4";
import { AgentStatusCardV4 } from "./premium/AgentStatusCardV4";
import { ChatActionBar } from "./ChatActionBar";

/**
 * Workspace chat V4 intégré dans l'AppShell prod.
 * Cohérent avec le design system MyBotIA prod (tokens surface/accent/text).
 * Pas de sidebar globale — l'AppShell prod la fournit. Seulement la zone chat
 * avec une mini-sidebar interne dossiers/conversations + thread + composer.
 */
export function ConversationsV4Workspace() {
  const [folders, setFolders] = useState<FolderApi[]>([]);
  const [conversations, setConversations] = useState<ConversationApi[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [activeConv, setActiveConv] = useState<ConversationApi | null>(null);
  const [messages, setMessages] = useState<MessageApi[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showNewConv, setShowNewConv] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendStartedAt, setSendStartedAt] = useState<number | null>(null);
  const [openFolderIds, setOpenFolderIds] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const lsKey = user?.email ? `v4-open-folders:${user.email}` : null;

  // Charger état collapse depuis localStorage
  useEffect(() => {
    if (!lsKey) return;
    try {
      const stored = localStorage.getItem(lsKey);
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr)) setOpenFolderIds(new Set(arr.filter((x): x is string => typeof x === "string")));
      }
    } catch {
      /* ignore */
    }
  }, [lsKey]);

  // Sauvegarder à chaque changement
  useEffect(() => {
    if (!lsKey) return;
    try {
      localStorage.setItem(lsKey, JSON.stringify(Array.from(openFolderIds)));
    } catch {
      /* ignore */
    }
  }, [openFolderIds, lsKey]);

  const toggleFolder = useCallback((folderId: string) => {
    setOpenFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  const ensureFolderOpen = useCallback((folderId: string) => {
    setOpenFolderIds((prev) => {
      if (prev.has(folderId)) return prev;
      const next = new Set(prev);
      next.add(folderId);
      return next;
    });
  }, []);

  const refreshLists = useCallback(async () => {
    setLoadingList(true);
    try {
      const [fs, cs] = await Promise.all([
        v4Api.listFolders(),
        v4Api.listConversations(),
      ]);
      setFolders(fs);
      setConversations(cs);
    } catch (e) {
      setErrorBanner((e as Error).message);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    refreshLists();
  }, [refreshLists]);

  // Auto-ouvrir le dossier de la conversation active
  useEffect(() => {
    if (!activeConvId) return;
    const c = conversations.find((x) => x.id === activeConvId);
    if (c?.folderId) ensureFolderOpen(c.folderId);
  }, [activeConvId, conversations, ensureFolderOpen]);

  // V1 garde-fou Voice (Agent 4 — 2026-05-08) : publier la conv active vers
  // le VoiceConvProvider posé dans AppShell. ContextRail/VoicePanel lisent ça
  // pour afficher le client/projet lié et le transmettre au server voice.
  const { setVoiceConvContext } = useVoiceConvContext();
  useEffect(() => {
    if (!activeConv) {
      setVoiceConvContext(null);
      return;
    }
    setVoiceConvContext({
      conversationId: activeConv.id,
      clientRef: activeConv.clientRef,
      projectRef: activeConv.projectRef,
      channel: activeConv.channel,
    });
    // À l'unmount de la page, on clear pour ne pas laisser un contexte fantôme.
    return () => {
      setVoiceConvContext(null);
    };
  }, [activeConv, setVoiceConvContext]);

  useEffect(() => {
    if (!activeConvId) {
      setActiveConv(null);
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    Promise.all([
      v4Api.getConversation(activeConvId),
      v4Api.listMessages(activeConvId),
    ])
      .then(([conv, msgs]) => {
        if (!cancelled) {
          setActiveConv(conv);
          setMessages(msgs);
        }
      })
      .catch((e) => {
        if (!cancelled) setErrorBanner((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoadingMessages(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeConvId]);

  const handleConversationCreated = useCallback((conv: ConversationApi) => {
    setConversations((prev) => [conv, ...prev]);
    setShowNewConv(false);
    setActiveConvId(conv.id);
  }, []);

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!activeConvId || !content.trim()) return;
      const optimistic: MessageApi = {
        id: `optimistic-${Date.now()}`,
        conversationId: activeConvId,
        role: "user",
        content,
        toolCalls: null,
        attachments: null,
        sources: null,
        modelTier: "standard",
        pinnedAt: null,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      setSending(true);
      setSendStartedAt(Date.now());
      try {
        const { userMessage, assistantMessage } = await v4Api.sendMessage(
          activeConvId,
          content
        );
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== optimistic.id),
          userMessage,
          assistantMessage,
        ]);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConvId
              ? {
                  ...c,
                  lastMessageAt: assistantMessage.createdAt,
                  messageCount: c.messageCount + 2,
                }
              : c
          )
        );
      } catch (e) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setErrorBanner((e as Error).message);
      } finally {
        setSending(false);
        setSendStartedAt(null);
      }
    },
    [activeConvId]
  );

  const conversationsByFolder = (folderId: string | null) =>
    conversations.filter((c) => c.folderId === folderId);

  const handleMoveConversation = useCallback(
    async (convId: string, targetFolderId: string | null) => {
      try {
        const updated = await v4Api.updateConversation(convId, {
          folderId: targetFolderId,
        });
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, folderId: updated.folderId } : c))
        );
        if (activeConvId === convId) {
          setActiveConv((prev) =>
            prev ? { ...prev, folderId: updated.folderId } : prev
          );
        }
        // Ouvrir le dossier cible pour rendre la conversation immédiatement visible
        if (targetFolderId) ensureFolderOpen(targetFolderId);
      } catch (e) {
        setErrorBanner((e as Error).message);
      }
    },
    [activeConvId, ensureFolderOpen]
  );

  // Suppression / archivage / renommage --------------------------------------

  type ConfirmAction =
    | { kind: "conv-delete"; convId: string; title: string }
    | { kind: "folder-archive"; folderId: string; name: string; count: number }
    | { kind: "folder-delete"; folderId: string; name: string; count: number };

  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);

  const removeConvFromState = useCallback(
    (convId: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      setActiveConvId((prev) => (prev === convId ? null : prev));
      setActiveConv((prev) => (prev?.id === convId ? null : prev));
    },
    []
  );

  const handleArchiveConversation = useCallback(async (convId: string) => {
    try {
      await v4Api.archiveConversation(convId);
      removeConvFromState(convId);
    } catch (e) {
      setErrorBanner((e as Error).message);
    }
  }, [removeConvFromState]);

  const handleDeleteConversation = useCallback(async (convId: string) => {
    try {
      await v4Api.deleteConversation(convId);
      removeConvFromState(convId);
    } catch (e) {
      setErrorBanner((e as Error).message);
    }
  }, [removeConvFromState]);

  const handleRenameFolder = useCallback(async (folderId: string, name: string) => {
    try {
      const updated = await v4Api.renameFolder(folderId, name);
      setFolders((prev) =>
        prev.map((f) => (f.id === folderId ? { ...f, name: updated.name } : f))
      );
    } catch (e) {
      setErrorBanner((e as Error).message);
      throw e;
    }
  }, []);

  const handleArchiveFolder = useCallback(
    async (
      folderId: string,
      cascade?: "archive-children" | "move-out"
    ) => {
      try {
        await v4Api.archiveFolder(folderId, cascade);
        setFolders((prev) => prev.filter((f) => f.id !== folderId));
        if (cascade === "archive-children") {
          setConversations((prev) => prev.filter((c) => c.folderId !== folderId));
          setActiveConvId((prev) => {
            const c = conversations.find((x) => x.id === prev);
            return c?.folderId === folderId ? null : prev;
          });
        } else if (cascade === "move-out") {
          setConversations((prev) =>
            prev.map((c) => (c.folderId === folderId ? { ...c, folderId: null } : c))
          );
        }
      } catch (e) {
        setErrorBanner((e as Error).message);
      }
    },
    [conversations]
  );

  const handleDeleteFolder = useCallback(
    async (
      folderId: string,
      cascade?: "delete-children" | "move-out"
    ) => {
      try {
        await v4Api.deleteFolder(folderId, cascade);
        setFolders((prev) => prev.filter((f) => f.id !== folderId));
        if (cascade === "delete-children") {
          setConversations((prev) => prev.filter((c) => c.folderId !== folderId));
          setActiveConvId((prev) => {
            const c = conversations.find((x) => x.id === prev);
            return c?.folderId === folderId ? null : prev;
          });
        } else if (cascade === "move-out") {
          setConversations((prev) =>
            prev.map((c) => (c.folderId === folderId ? { ...c, folderId: null } : c))
          );
        }
      } catch (e) {
        setErrorBanner((e as Error).message);
      }
    },
    [conversations]
  );

  const askDeleteConv = useCallback((conv: ConversationApi) => {
    setConfirmAction({ kind: "conv-delete", convId: conv.id, title: conv.title });
  }, []);

  const askDeleteFolder = useCallback(
    (f: FolderApi) => {
      const count = conversationsByFolder(f.id).length;
      setConfirmAction({ kind: "folder-delete", folderId: f.id, name: f.name, count });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversations]
  );

  const askArchiveFolder = useCallback(
    (f: FolderApi) => {
      const count = conversationsByFolder(f.id).length;
      if (count === 0) {
        // Pas de conv : archive direct sans modale.
        handleArchiveFolder(f.id);
        return;
      }
      setConfirmAction({ kind: "folder-archive", folderId: f.id, name: f.name, count });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversations, handleArchiveFolder]
  );

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Mini-sidebar interne : dossiers + conversations */}
      <aside className="w-[280px] shrink-0 flex flex-col border-r border-border-subtle bg-surface-1">
        <div className="px-4 py-3 border-b border-border-subtle">
          <button
            type="button"
            onClick={() => setShowNewConv(true)}
            className="w-full inline-flex items-center justify-center gap-2 h-9 px-3 rounded-lg bg-accent-primary text-white text-sm font-medium hover:bg-accent-secondary transition-colors"
          >
            <Plus size={16} strokeWidth={1.5} />
            Nouvelle conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {/* Dossiers */}
          <section className="mb-4">
            <div className="px-3 mb-1 flex items-center">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-text-muted">
                Dossiers
              </span>
              <button
                type="button"
                aria-label="Nouveau dossier"
                onClick={() => setShowNewFolder(true)}
                className="ml-auto p-0.5 rounded text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
              >
                <Plus size={12} strokeWidth={1.5} />
              </button>
            </div>
            {loadingList && folders.length === 0 ? (
              <div className="px-3 text-xs text-text-muted">Chargement…</div>
            ) : folders.length === 0 ? (
              <div className="px-3 text-xs text-text-muted">Aucun dossier</div>
            ) : (
              folders.map((f) => {
                const count = conversationsByFolder(f.id).length;
                const isOpen = openFolderIds.has(f.id);
                return (
                  <div key={f.id} className="px-1">
                    <FolderRow
                      folder={f}
                      count={count}
                      isOpen={isOpen}
                      onToggle={() => toggleFolder(f.id)}
                      onRename={() => setRenameTarget({ id: f.id, name: f.name })}
                      onArchive={() => askArchiveFolder(f)}
                      onDelete={() => askDeleteFolder(f)}
                    />
                    {isOpen &&
                      conversationsByFolder(f.id).map((c) => (
                        <ConvLink
                          key={c.id}
                          conv={c}
                          active={c.id === activeConvId}
                          onClick={() => setActiveConvId(c.id)}
                          folders={folders}
                          onMove={(target) =>
                            handleMoveConversation(c.id, target)
                          }
                          onArchive={() => handleArchiveConversation(c.id)}
                          onDelete={() => askDeleteConv(c)}
                          nested
                        />
                      ))}
                  </div>
                );
              })
            )}
          </section>

          {/* Sans dossier */}
          <section>
            <div className="px-3 mb-1 text-[11px] font-semibold tracking-wider uppercase text-text-muted">
              Sans dossier
            </div>
            {conversationsByFolder(null).length === 0 ? (
              <div className="px-3 text-xs text-text-muted">Aucune conversation</div>
            ) : (
              conversationsByFolder(null).map((c) => (
                <ConvLink
                  key={c.id}
                  conv={c}
                  active={c.id === activeConvId}
                  onClick={() => setActiveConvId(c.id)}
                  folders={folders}
                  onMove={(target) => handleMoveConversation(c.id, target)}
                  onArchive={() => handleArchiveConversation(c.id)}
                  onDelete={() => askDeleteConv(c)}
                />
              ))
            )}
          </section>
        </div>

        {errorBanner && (
          <div className="m-3 p-2 rounded-md bg-status-danger/10 border border-status-danger/30 text-xs text-status-danger flex items-center gap-2">
            <span className="flex-1">{errorBanner}</span>
            <button onClick={() => setErrorBanner(null)} aria-label="Fermer">
              <X size={12} strokeWidth={1.5} />
            </button>
          </div>
        )}
      </aside>

      {/* Zone chat principale */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {!activeConvId ? (
          <WelcomeState onNew={() => setShowNewConv(true)} />
        ) : (
          <ConversationView
            conv={activeConv}
            conversationId={activeConvId}
            messages={messages}
            loading={loadingMessages}
            sending={sending}
            sendStartedAt={sendStartedAt}
            onSend={handleSendMessage}
          />
        )}
      </main>

      {showNewConv && (
        <NewConversationModal
          folders={folders}
          onClose={() => setShowNewConv(false)}
          onCreated={handleConversationCreated}
          onFolderCreated={(f) => setFolders((prev) => [f, ...prev])}
        />
      )}

      {showNewFolder && (
        <NewFolderModal
          onClose={() => setShowNewFolder(false)}
          onCreated={(f) => {
            setFolders((prev) => [f, ...prev]);
            setShowNewFolder(false);
          }}
        />
      )}

      {renameTarget && (
        <RenameFolderModal
          currentName={renameTarget.name}
          onClose={() => setRenameTarget(null)}
          onConfirm={async (name) => {
            await handleRenameFolder(renameTarget.id, name);
            setRenameTarget(null);
          }}
        />
      )}

      {confirmAction && (
        <ConfirmActionModal
          action={confirmAction}
          onClose={() => setConfirmAction(null)}
          onConvDelete={async () => {
            if (confirmAction.kind !== "conv-delete") return;
            await handleDeleteConversation(confirmAction.convId);
            setConfirmAction(null);
          }}
          onFolderArchive={async (cascade) => {
            if (confirmAction.kind !== "folder-archive") return;
            await handleArchiveFolder(confirmAction.folderId, cascade);
            setConfirmAction(null);
          }}
          onFolderDelete={async (cascade) => {
            if (confirmAction.kind !== "folder-delete") return;
            await handleDeleteFolder(confirmAction.folderId, cascade);
            setConfirmAction(null);
          }}
        />
      )}
    </div>
  );
}

function NewFolderModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (f: FolderApi) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const f = await v4Api.createFolder(trimmed);
      onCreated(f);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-surface-1 border border-border-default rounded-2xl p-6 w-[min(420px,90vw)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center mb-4">
          <h2 className="text-base font-semibold text-text-primary">
            Nouveau dossier
          </h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="ml-auto text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-secondary">
            Nom du dossier
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
            }}
            autoFocus
            placeholder="Ex: Clients prospects"
            maxLength={200}
            className="bg-surface-2 border border-border-subtle rounded-lg px-3 h-9 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20"
          />
        </label>

        {err && (
          <div className="mt-3 px-3 py-2 rounded-md bg-status-danger/10 border border-status-danger/30 text-xs text-status-danger">
            {err}
          </div>
        )}

        <div className="flex gap-2 justify-end mt-4">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-border-default text-text-secondary text-sm hover:bg-surface-2 transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!name.trim() || busy}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-accent-primary text-white text-sm font-medium hover:bg-accent-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {busy ? (
              <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
            ) : (
              <Plus size={14} strokeWidth={1.5} />
            )}
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageRow({
  message,
  agentId,
  agentName,
  clientContext,
  onSeedPrompt,
}: {
  message: MessageApi;
  agentId: string;
  agentName: string;
  clientContext?: { id: string; name: string } | null;
  onSeedPrompt?: (text: string) => void;
}) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore (copy denied)
    }
  };

  const isOptimistic = message.id.startsWith("optimistic-");

  return (
    <div
      className={`group flex gap-3 motion-safe:animate-fade-in ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      <div className="shrink-0 mt-1">
        {isUser ? (
          <UserAvatarV4
            email={user?.email}
            name={user?.first_name ? `${user.first_name} ${user.last_name ?? ""}`.trim() : undefined}
            size={32}
          />
        ) : (
          <AgentAvatar agentId={agentId} size={32} className="rounded-full" />
        )}
      </div>
      <div className={`flex flex-col gap-1 max-w-[75%] ${isUser ? "items-end" : "items-start"}`}>
        <div className="text-[10px] text-text-muted px-1">
          {isUser ? "Vous" : agentName}
        </div>
        <div
          className={`relative px-4 py-3 ${
            isUser
              ? "bg-accent-primary/10 border border-accent-primary/25 rounded-2xl rounded-tr-sm"
              : "bg-surface-2 border border-border-subtle rounded-2xl rounded-tl-sm"
          } ${isOptimistic ? "opacity-70" : ""}`}
        >
          {isUser ? (
            <div className="text-sm whitespace-pre-wrap leading-relaxed text-text-primary">
              {message.content}
            </div>
          ) : (
            <div className="text-sm leading-relaxed text-text-primary">
              <MarkdownRenderer content={message.content} />
            </div>
          )}
          {!isOptimistic && (
            <button
              type="button"
              onClick={onCopy}
              aria-label="Copier le message"
              className={`absolute -top-2 ${
                isUser ? "-left-2" : "-right-2"
              } opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 rounded-full bg-surface-1 border border-border-default text-text-muted hover:text-text-primary flex items-center justify-center`}
            >
              {copied ? (
                <CheckCheck size={12} strokeWidth={1.5} className="text-status-success" />
              ) : (
                <Copy size={12} strokeWidth={1.5} />
              )}
            </button>
          )}
        </div>
        {!isUser && !isOptimistic && (
          <ChatActionBar
            agentName={agentName}
            messageContent={message.content}
            clientContext={clientContext ?? undefined}
            onSeedPrompt={onSeedPrompt}
          />
        )}
      </div>
    </div>
  );
}

function TypingRow({
  agentId,
  agentName,
  status,
}: {
  agentId: string;
  agentName: string;
  status: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex gap-3 flex-row motion-safe:animate-fade-in"
    >
      <div className="shrink-0 mt-1">
        <AgentAvatar agentId={agentId} size={32} className="rounded-full" />
      </div>
      <div className="flex flex-col gap-1 max-w-[75%] items-start">
        <div className="text-[10px] text-text-muted px-1">{agentName}</div>
        <div className="px-4 py-3 bg-surface-2 border border-border-subtle rounded-2xl rounded-tl-sm">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span className="inline-flex gap-1">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full bg-text-muted motion-safe:animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="inline-block w-1.5 h-1.5 rounded-full bg-text-muted motion-safe:animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="inline-block w-1.5 h-1.5 rounded-full bg-text-muted motion-safe:animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </span>
            <span>{status}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConvLink({
  conv,
  active,
  onClick,
  folders,
  onMove,
  onArchive,
  onDelete,
  nested = false,
}: {
  conv: ConversationApi;
  active: boolean;
  onClick: () => void;
  folders: FolderApi[];
  onMove: (folderId: string | null) => void;
  onArchive?: () => void;
  onDelete?: () => void;
  nested?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fermer le menu sur click extérieur
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  return (
    <div
      className={`relative group flex flex-col gap-0.5 px-3 py-2 rounded-md transition-colors cursor-pointer ${
        nested ? "ml-4" : ""
      } ${
        active
          ? "bg-accent-primary/10 border-l-2 border-accent-primary -ml-px"
          : "hover:bg-surface-2 border-l-2 border-transparent -ml-px"
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <MessageSquare
          size={13}
          strokeWidth={1.5}
          className={active ? "text-accent-primary" : "text-text-muted"}
        />
        <span
          className={`flex-1 truncate text-sm ${
            active ? "text-text-primary font-medium" : "text-text-secondary"
          }`}
        >
          {conv.title}
        </span>
        <button
          type="button"
          aria-label="Options"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-surface-3 text-text-muted"
        >
          <MoreHorizontal size={14} strokeWidth={1.5} />
        </button>
      </div>
      <div className="ml-5 text-[10px] text-text-muted flex gap-2">
        <span>{conv.agentName}</span>
        {conv.messageCount > 0 && <span>· {conv.messageCount} msg</span>}
      </div>

      {menuOpen && (
        <div
          ref={menuRef}
          onClick={(e) => e.stopPropagation()}
          className="absolute z-20 right-2 top-9 min-w-[200px] bg-surface-1 border border-border-default rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto"
        >
          <div className="px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase text-text-muted">
            Déplacer vers
          </div>
          <button
            type="button"
            onClick={() => {
              onMove(null);
              setMenuOpen(false);
            }}
            className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2 flex items-center gap-2"
          >
            {conv.folderId === null && (
              <Check size={12} strokeWidth={2} className="text-accent-primary" />
            )}
            <span className={conv.folderId === null ? "ml-0" : "ml-[18px]"}>
              Sans dossier
            </span>
          </button>
          {folders.length > 0 && (
            <div className="my-1 border-t border-border-subtle" />
          )}
          {folders.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                onMove(f.id);
                setMenuOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2 flex items-center gap-2"
            >
              {conv.folderId === f.id && (
                <Check size={12} strokeWidth={2} className="text-accent-primary" />
              )}
              <span className={conv.folderId === f.id ? "ml-0" : "ml-[18px]"}>
                {f.name}
              </span>
            </button>
          ))}

          {(onArchive || onDelete) && (
            <div className="my-1 border-t border-border-subtle" />
          )}
          {onArchive && (
            <button
              type="button"
              onClick={() => {
                onArchive();
                setMenuOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2 flex items-center gap-2"
            >
              <Archive size={12} strokeWidth={1.5} className="text-text-muted" />
              <span>Archiver</span>
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete();
                setMenuOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 text-sm text-status-danger hover:bg-status-danger/10 flex items-center gap-2"
            >
              <Trash2 size={12} strokeWidth={1.5} />
              <span>Supprimer définitivement</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FolderRow({
  folder,
  count,
  isOpen,
  onToggle,
  onRename,
  onArchive,
  onDelete,
}: {
  folder: FolderApi;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  onRename: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  return (
    <div className="relative group flex items-center h-8 rounded-md hover:bg-surface-2 transition-colors">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex-1 flex items-center gap-1.5 h-8 px-2 text-text-secondary text-left"
      >
        {isOpen ? (
          <ChevronDown size={12} strokeWidth={1.5} className="text-text-muted shrink-0" />
        ) : (
          <ChevronRight size={12} strokeWidth={1.5} className="text-text-muted shrink-0" />
        )}
        {isOpen ? (
          <FolderOpen size={14} strokeWidth={1.5} className="shrink-0" />
        ) : (
          <FolderClosed size={14} strokeWidth={1.5} className="shrink-0" />
        )}
        <span className="flex-1 truncate text-sm">{folder.name}</span>
        <span className="text-[10px] text-text-muted shrink-0">{count}</span>
      </button>
      <button
        type="button"
        aria-label="Options dossier"
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((v) => !v);
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 mr-1 rounded hover:bg-surface-3 text-text-muted"
      >
        <MoreHorizontal size={14} strokeWidth={1.5} />
      </button>

      {menuOpen && (
        <div
          ref={menuRef}
          onClick={(e) => e.stopPropagation()}
          className="absolute z-20 right-2 top-8 min-w-[200px] bg-surface-1 border border-border-default rounded-lg shadow-lg py-1"
        >
          <button
            type="button"
            onClick={() => {
              onRename();
              setMenuOpen(false);
            }}
            className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2 flex items-center gap-2"
          >
            <Pencil size={12} strokeWidth={1.5} className="text-text-muted" />
            <span>Renommer</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onArchive();
              setMenuOpen(false);
            }}
            className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2 flex items-center gap-2"
          >
            <Archive size={12} strokeWidth={1.5} className="text-text-muted" />
            <span>Archiver</span>
          </button>
          <div className="my-1 border-t border-border-subtle" />
          <button
            type="button"
            onClick={() => {
              onDelete();
              setMenuOpen(false);
            }}
            className="w-full text-left px-3 py-1.5 text-sm text-status-danger hover:bg-status-danger/10 flex items-center gap-2"
          >
            <Trash2 size={12} strokeWidth={1.5} />
            <span>Supprimer définitivement</span>
          </button>
        </div>
      )}
    </div>
  );
}

function RenameFolderModal({
  currentName,
  onClose,
  onConfirm,
}: {
  currentName: string;
  onClose: () => void;
  onConfirm: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(currentName);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === currentName) {
      onClose();
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onConfirm(trimmed);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-[420px] max-w-[90vw] bg-surface-1 border border-border-default rounded-lg shadow-xl p-5"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-primary">
            Renommer le dossier
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="p-1 text-text-muted hover:text-text-primary"
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>
        <input
          type="text"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          className="w-full px-3 py-2 bg-surface-2 border border-border-default rounded-md text-sm text-text-primary focus:outline-none focus:border-accent-primary"
        />
        {err && (
          <div className="mt-2 text-xs text-status-danger">{err}</div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 h-8 rounded-md text-sm text-text-secondary hover:bg-surface-2"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="px-3 h-8 rounded-md text-sm bg-accent-primary text-white disabled:opacity-50 hover:bg-accent-secondary"
          >
            {busy ? "…" : "Renommer"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ConfirmActionModal({
  action,
  onClose,
  onConvDelete,
  onFolderArchive,
  onFolderDelete,
}: {
  action:
    | { kind: "conv-delete"; convId: string; title: string }
    | { kind: "folder-archive"; folderId: string; name: string; count: number }
    | { kind: "folder-delete"; folderId: string; name: string; count: number };
  onClose: () => void;
  onConvDelete: () => Promise<void>;
  onFolderArchive: (cascade?: "archive-children" | "move-out") => Promise<void>;
  onFolderDelete: (cascade?: "delete-children" | "move-out") => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  let title = "";
  let body: React.ReactNode = null;
  let actions: React.ReactNode = null;

  if (action.kind === "conv-delete") {
    title = "Supprimer définitivement la conversation ?";
    body = (
      <p className="text-sm text-text-secondary">
        La conversation <strong>« {action.title} »</strong> et tous ses messages
        seront supprimés. Cette action est irréversible.
      </p>
    );
    actions = (
      <>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="px-3 h-8 rounded-md text-sm text-text-secondary hover:bg-surface-2"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={() => run(onConvDelete)}
          disabled={busy}
          className="px-3 h-8 rounded-md text-sm bg-status-danger text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "…" : "Supprimer définitivement"}
        </button>
      </>
    );
  } else if (action.kind === "folder-archive") {
    title = `Archiver le dossier « ${action.name} » ?`;
    body = (
      <p className="text-sm text-text-secondary">
        Ce dossier contient <strong>{action.count}</strong> conversation
        {action.count > 1 ? "s" : ""}. Que faire d&apos;elles ?
      </p>
    );
    actions = (
      <>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="px-3 h-8 rounded-md text-sm text-text-secondary hover:bg-surface-2"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={() => run(() => onFolderArchive("move-out"))}
          disabled={busy}
          className="px-3 h-8 rounded-md text-sm border border-border-default text-text-primary hover:bg-surface-2"
        >
          Déplacer hors du dossier
        </button>
        <button
          type="button"
          onClick={() => run(() => onFolderArchive("archive-children"))}
          disabled={busy}
          className="px-3 h-8 rounded-md text-sm bg-accent-primary text-white hover:bg-accent-secondary disabled:opacity-50"
        >
          {busy ? "…" : "Archiver aussi les conversations"}
        </button>
      </>
    );
  } else {
    // folder-delete
    title = `Supprimer définitivement le dossier « ${action.name} » ?`;
    if (action.count === 0) {
      body = (
        <p className="text-sm text-text-secondary">
          Le dossier est vide. Cette action est irréversible.
        </p>
      );
      actions = (
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3 h-8 rounded-md text-sm text-text-secondary hover:bg-surface-2"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => run(() => onFolderDelete())}
            disabled={busy}
            className="px-3 h-8 rounded-md text-sm bg-status-danger text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "…" : "Supprimer"}
          </button>
        </>
      );
    } else {
      body = (
        <p className="text-sm text-text-secondary">
          Ce dossier contient <strong>{action.count}</strong> conversation
          {action.count > 1 ? "s" : ""}. Que faire d&apos;elles&nbsp;? Aucune
          action n&apos;est silencieuse.
        </p>
      );
      actions = (
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3 h-8 rounded-md text-sm text-text-secondary hover:bg-surface-2"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => run(() => onFolderDelete("move-out"))}
            disabled={busy}
            className="px-3 h-8 rounded-md text-sm border border-border-default text-text-primary hover:bg-surface-2"
          >
            Déplacer hors du dossier
          </button>
          <button
            type="button"
            onClick={() => run(() => onFolderDelete("delete-children"))}
            disabled={busy}
            className="px-3 h-8 rounded-md text-sm bg-status-danger text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "…" : "Supprimer aussi les conversations"}
          </button>
        </>
      );
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[520px] max-w-[92vw] bg-surface-1 border border-border-default rounded-lg shadow-xl p-5"
      >
        <div className="flex items-start justify-between gap-4 mb-3">
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="p-1 text-text-muted hover:text-text-primary"
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>
        <div className="mb-5">{body}</div>
        <div className="flex flex-wrap justify-end gap-2">{actions}</div>
      </div>
    </div>
  );
}

function WelcomeState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-text-muted gap-3 px-8 text-center">
      <Sparkles size={32} strokeWidth={1.2} className="text-accent-primary" />
      <div>
        <div className="text-lg font-medium text-text-primary">
          Sélectionnez une conversation
        </div>
        <div className="mt-1 text-sm">
          Ou créez-en une nouvelle pour démarrer.
        </div>
      </div>
      <button
        type="button"
        onClick={onNew}
        className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-accent-primary text-white text-sm font-medium hover:bg-accent-secondary transition-colors"
      >
        <Plus size={16} strokeWidth={1.5} />
        Nouvelle conversation
      </button>
    </div>
  );
}

function ConversationView({
  conv,
  conversationId,
  messages,
  loading,
  sending,
  sendStartedAt,
  onSend,
}: {
  conv: ConversationApi | null;
  conversationId: string | null;
  messages: MessageApi[];
  loading: boolean;
  sending: boolean;
  sendStartedAt: number | null;
  onSend: (content: string) => Promise<void>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  // Seed text injecté depuis ChatActionBar (Bloc 4D) : un prompt prêt à
  // l'emploi qui remplit le composer sans envoyer. Gilles relit, ajuste,
  // valide.
  const [seedText, setSeedText] = useState<string | null>(null);
  const seedPrompt = useCallback((text: string) => {
    setSeedText(text);
  }, []);
  const onSeedConsumed = useCallback(() => {
    setSeedText(null);
  }, []);

  // clientContext pour ChatActionBar — basé sur clientRef de la conv
  // (string opaque). Pas de fallback fake : si absent, undefined.
  const clientContext = conv?.clientRef
    ? { id: conv.clientRef, name: conv.clientRef }
    : null;

  // Statut texte selon durée écoulée pendant l'envoi
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!sending || !sendStartedAt) {
      setElapsed(0);
      return;
    }
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - sendStartedAt) / 1000));
    }, 500);
    return () => clearInterval(t);
  }, [sending, sendStartedAt]);

  const agentLabel = conv?.agentName ?? "Assistant";
  const sendingStatus =
    elapsed < 2
      ? `Connexion à ${agentLabel}…`
      : elapsed < 6
      ? `${agentLabel} réfléchit…`
      : `${agentLabel} analyse encore… (${elapsed}s)`;

  return (
    <>
      <header className="px-6 py-3 border-b border-border-subtle bg-surface-1 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-medium text-text-primary truncate">
            {conv?.title ?? "Conversation"}
          </div>
          <div className="text-xs text-text-muted truncate">
            {conv?.channel ?? ""}
          </div>
        </div>
        {conv && (
          <AgentStatusCardV4
            agentId={conv.agentId}
            agentName={conv.agentName}
          />
        )}
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-muted gap-2 text-sm">
            <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
            Chargement…
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            Aucun message — envoyez le premier ci-dessous.
          </div>
        ) : (
          <>
            {messages.map((m) => (
              <MessageRow
                key={m.id}
                message={m}
                agentId={conv?.agentId ?? "lea"}
                agentName={conv?.agentName ?? "Léa"}
                clientContext={clientContext}
                onSeedPrompt={seedPrompt}
              />
            ))}
            {sending && (
              <TypingRow agentId={conv?.agentId ?? "lea"} agentName={agentLabel} status={sendingStatus} />
            )}
          </>
        )}
      </div>

      <Composer
        onSend={onSend}
        conversationId={conversationId}
        archived={conv?.archivedAt != null}
        sending={sending}
        seedText={seedText}
        onSeedConsumed={onSeedConsumed}
      />
    </>
  );
}

function Composer({
  onSend,
  conversationId,
  archived,
  sending,
  seedText,
  onSeedConsumed,
}: {
  onSend: (content: string) => Promise<void>;
  conversationId: string | null;
  archived: boolean;
  sending: boolean;
  seedText?: string | null;
  onSeedConsumed?: () => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Seed text venu de ChatActionBar : on remplit le composer (sans envoi)
  // et on rend le focus à la zone de saisie pour relecture/ajustement.
  useEffect(() => {
    if (seedText && !archived) {
      setValue(seedText);
      textareaRef.current?.focus();
      onSeedConsumed?.();
    }
  }, [seedText, archived, onSeedConsumed]);

  // Focus auto à chaque changement de conversation (nouvelle session ouverte).
  useEffect(() => {
    if (conversationId && textareaRef.current && !archived) {
      textareaRef.current.focus();
    }
  }, [conversationId, archived]);

  // Re-focus quand l'envoi se termine (l'utilisateur peut enchaîner).
  useEffect(() => {
    if (!sending && conversationId && textareaRef.current && !archived) {
      textareaRef.current.focus();
    }
  }, [sending, conversationId, archived]);

  const canSend =
    !!conversationId && !!value.trim() && !busy && !archived && !sending;

  const submit = async () => {
    const content = value.trim();
    if (!canSend) return;
    setBusy(true);
    setValue("");
    try {
      await onSend(content);
    } finally {
      setBusy(false);
      // Re-focus après envoi pour saisie continue
      textareaRef.current?.focus();
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div
      className="relative z-10 px-6 py-3 border-t border-border-subtle bg-surface-1 flex gap-3 items-end shrink-0"
      style={{ pointerEvents: "auto" }}
    >
      <textarea
        ref={textareaRef}
        rows={2}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKey}
        readOnly={archived}
        tabIndex={0}
        placeholder={
          archived
            ? "Conversation archivée"
            : "Écrivez votre message… (Cmd/Ctrl+Enter pour envoyer)"
        }
        className="flex-1 resize-none bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20"
        style={{ pointerEvents: "auto" }}
      />
      <button
        type="button"
        onClick={() => void submit()}
        disabled={!canSend}
        aria-label="Envoyer"
        className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-accent-primary text-white hover:bg-accent-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {busy ? (
          <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
        ) : (
          <Send size={16} strokeWidth={1.5} />
        )}
      </button>
    </div>
  );
}

function NewConversationModal({
  folders,
  onClose,
  onCreated,
  onFolderCreated,
}: {
  folders: FolderApi[];
  onClose: () => void;
  onCreated: (conv: ConversationApi) => void;
  onFolderCreated: (f: FolderApi) => void;
}) {
  const [title, setTitle] = useState("");
  const [folderId, setFolderId] = useState<string>("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const createFolder = async () => {
    const name = newFolderName.trim();
    if (!name || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const f = await v4Api.createFolder(name);
      onFolderCreated(f);
      setFolderId(f.id);
      setCreatingFolder(false);
      setNewFolderName("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const conv = await v4Api.createConversation({
        title: title.trim() || undefined,
        folderId: folderId || null,
      });
      onCreated(conv);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-surface-1 border border-border-default rounded-2xl p-6 w-[min(480px,90vw)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center mb-4">
          <h2 className="text-base font-semibold text-text-primary">
            Nouvelle conversation
          </h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="ml-auto text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-secondary">
              Titre (facultatif)
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Auto-généré si laissé vide"
              className="bg-surface-2 border border-border-subtle rounded-lg px-3 h-9 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-secondary">
              Dossier (facultatif)
            </span>
            {creatingFolder ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      // Intercepter Enter pour ne PAS submit le form parent (création conversation).
                      e.preventDefault();
                      e.stopPropagation();
                      void createFolder();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      setCreatingFolder(false);
                      setNewFolderName("");
                    }
                  }}
                  placeholder="Nom du nouveau dossier"
                  autoFocus
                  className="flex-1 bg-surface-2 border border-border-subtle rounded-lg px-3 h-9 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20"
                />
                <button
                  type="button"
                  onClick={() => void createFolder()}
                  disabled={!newFolderName.trim() || busy}
                  className="h-9 px-3 rounded-lg border border-border-default text-text-secondary text-xs hover:bg-surface-2 disabled:opacity-50"
                >
                  Créer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreatingFolder(false);
                    setNewFolderName("");
                  }}
                  className="h-9 px-3 rounded-lg border border-border-default text-text-secondary text-xs hover:bg-surface-2"
                >
                  Annuler
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  className="flex-1 bg-surface-2 border border-border-subtle rounded-lg px-3 h-9 text-sm text-text-primary focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20"
                >
                  <option value="">— Aucun dossier —</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setCreatingFolder(true)}
                  className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-border-default text-text-secondary text-xs hover:bg-surface-2"
                >
                  <Plus size={12} strokeWidth={1.5} />
                  Nouveau
                </button>
              </div>
            )}
          </label>

          {err && (
            <div className="px-3 py-2 rounded-md bg-status-danger/10 border border-status-danger/30 text-xs text-status-danger">
              {err}
            </div>
          )}

          <div className="flex gap-2 justify-end mt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-lg border border-border-default text-text-secondary text-sm hover:bg-surface-2 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-accent-primary text-white text-sm font-medium hover:bg-accent-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {busy ? (
                <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
              ) : (
                <Plus size={14} strokeWidth={1.5} />
              )}
              Créer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
