"use client";

import { useState, useEffect, useCallback } from "react";
import type { Client, Project, Agent, Deal, Activity, Metric } from "@/types";

// Generic fetcher with fallback and refetch
function useApi<T>(url: string | null, fallback: T): {
  data: T;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    if (!url) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }

    setLoading(true);

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url, tick]);

  return { data, loading, error, refetch };
}

// --- Typed hooks ---

// Hooks scoped — Bloc 5G-bis. Le serveur résout le tenant via hostname,
// pas via query. Plus jamais de tenant_slug forcé côté frontend.
export function useScopedClients() {
  return useApi<Client[]>("/api/clients", []);
}

// Alias rétro-compat — même comportement que useScopedClients depuis 5G-bis
// (le serveur ignore désormais tenant_slug si fourni en doublon du hostname).
export const useMybotiaClients = useScopedClients;

// Variante avec slug explicite — réservée à la future zone admin.
export function useClients(tenantSlug?: string) {
  const url = tenantSlug
    ? `/api/clients?tenant_slug=${encodeURIComponent(tenantSlug)}`
    : "/api/clients";
  return useApi<Client[]>(url, []);
}

export function useClient(id: string) {
  return useApi<{
    client: Client;
    contacts: {
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      role: string | null;
    }[];
    activities: Activity[];
    invoices: {
      id: string;
      ref: string;
      total: number;
      status: string;
      date?: string;
    }[];
    proposals: {
      id: string;
      ref: string;
      total: number;
      status: string;
      date: string;
      expiryDate: string;
    }[];
    projects: Project[];
  } | null>(`/api/clients/${id}`, null);
}

export function useScopedProjects() {
  return useApi<Project[]>("/api/projects", []);
}
export const useMybotiaProjects = useScopedProjects;

export function useProjects(tenantSlug?: string) {
  const url = tenantSlug
    ? `/api/projects?tenant_slug=${encodeURIComponent(tenantSlug)}`
    : "/api/projects";
  return useApi<Project[]>(url, []);
}

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  progress: number;
  projectId: string;
  projectName: string;
  projectRef: string;
  /** Bloc 5D — clientId (socid) résolu via le projet pour jointure tenant-safe. */
  clientId?: string;
  /** Bloc 5B-security — tenant Dolibarr d'origine (propagé pour DELETE multi-tenant safe). */
  tenantSlug?: string;
  dueDate?: string;
  overdue?: boolean;
  createdAt: string;
}

export function useScopedTasks() {
  return useApi<TaskItem[]>("/api/tasks", []);
}
export const useMybotiaTasks = useScopedTasks;

export function useTasks(tenantSlug?: string) {
  const url = tenantSlug
    ? `/api/tasks?tenant_slug=${encodeURIComponent(tenantSlug)}`
    : "/api/tasks";
  return useApi<TaskItem[]>(url, []);
}

export function useTodayTasks() {
  // Cockpit verrouillé via hostname — pas de tenant_slug forcé côté client.
  return useApi<TaskItem[]>("/api/tasks?today=1&mine=1", []);
}

export function useAgents(all = false, enabled = true) {
  const url = enabled ? (all ? "/api/agents?all=true" : "/api/agents") : null;
  return useApi<Agent[]>(url, []);
}

/** Bloc 5C — types light pour le cockpit Aujourd'hui. Source : /api/dashboard. */
export interface DashboardProposal {
  id: string;
  ref: string;
  total: number;
  status: "draft" | "validated" | "signed" | "refused" | "billed";
  date: string;
  expiryDate: string;
  tenantSlug?: string;
  clientId?: string;
  clientName?: string;
}

export interface DashboardInvoice {
  id: string;
  ref: string;
  total: number;
  status: "draft" | "sent" | "paid" | "late";
  date: string;
  dueDate?: string;
  daysOverdue?: number;
  tenantSlug?: string;
  clientId?: string;
  clientName?: string;
}

export interface DashboardData {
  metrics: Metric[];
  clients: Client[];
  projects: Project[];
  deals: Deal[];
  proposals: DashboardProposal[];
  invoices: DashboardInvoice[];
  activities: Activity[];
}

export function useScopedDashboard() {
  return useApi<DashboardData | null>("/api/dashboard", null);
}
export const useMybotiaDashboard = useScopedDashboard;

export function useDashboard(tenantSlug?: string) {
  const url = tenantSlug
    ? `/api/dashboard?tenant_slug=${encodeURIComponent(tenantSlug)}`
    : "/api/dashboard";
  return useApi<DashboardData | null>(url, null);
}

export interface DocumentItem {
  id: string;
  type: "devis" | "facture";
  ref: string;
  dolibarrId: string;
  clientName: string;
  totalTTC: number;
  status: string;
  date: string;
  modulepart: string;
  /** tenant Dolibarr d'origine (propagé pour filtrage cockpit). */
  tenantSlug?: string;
}

export function useScopedDocuments() {
  return useApi<DocumentItem[]>("/api/documents", []);
}
export const useMybotiaDocuments = useScopedDocuments;

export function useDocuments(tenantSlug?: string) {
  const url = tenantSlug
    ? `/api/documents?tenant_slug=${encodeURIComponent(tenantSlug)}`
    : "/api/documents";
  return useApi<DocumentItem[]>(url, []);
}

// --- Conversations ---

export interface ConversationItem {
  id: string;
  sessionId: string;
  agentId: string;
  agentName: string;
  key: string;
  channel: string;
  target: string;
  updatedAt: string;
  model: string;
  title: string;
  projectId?: string;
  projectRef?: string;
  projectName?: string;
  folderId?: string | null;
}

export interface ConversationFolderItem {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  count: number;
}

// Bloc 4B — trace des outils appelés par l'agent (issus du final event bridge)
export interface ToolCall {
  name: string;
  category: "kb" | "crm" | "file" | "shell" | "web" | "other";
  args: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  sender?: string;
  toolsCalled?: ToolCall[];
}

export function useConversations() {
  return useApi<ConversationItem[]>("/api/conversations", []);
}

export function useFolders() {
  return useApi<ConversationFolderItem[]>("/api/folders", []);
}

export function useMessages(sessionId: string | null) {
  return useApi<ChatMessage[]>(
    sessionId ? `/api/conversations/${sessionId}/messages` : "",
    []
  );
}

// --- Mutations conversations / folders ---

export async function deleteConversationApi(id: string): Promise<void> {
  const res = await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function moveConversationApi(
  id: string,
  folderId: string | null
): Promise<void> {
  const res = await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder_id: folderId }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function renameConversationApi(
  id: string,
  title: string
): Promise<void> {
  const res = await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function createFolderApi(name: string): Promise<ConversationFolderItem> {
  const res = await fetch(`/api/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function renameFolderApi(id: string, name: string): Promise<void> {
  const res = await fetch(`/api/folders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function deleteFolderApi(id: string): Promise<void> {
  const res = await fetch(`/api/folders/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
