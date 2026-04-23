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

export function useClients() {
  return useApi<Client[]>("/api/clients", []);
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

export function useProjects() {
  return useApi<Project[]>("/api/projects", []);
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
  dueDate?: string;
  createdAt: string;
}

export function useTasks() {
  return useApi<TaskItem[]>("/api/tasks", []);
}

export function useAgents(all = false, enabled = true) {
  const url = enabled ? (all ? "/api/agents?all=true" : "/api/agents") : null;
  return useApi<Agent[]>(url, []);
}

export interface DashboardData {
  metrics: Metric[];
  clients: Client[];
  projects: Project[];
  deals: Deal[];
  activities: Activity[];
}

export function useDashboard() {
  return useApi<DashboardData | null>("/api/dashboard", null);
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
}

export function useDocuments() {
  return useApi<DocumentItem[]>("/api/documents", []);
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
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  sender?: string;
}

export function useConversations() {
  return useApi<ConversationItem[]>("/api/conversations", []);
}

export function useMessages(sessionId: string | null) {
  return useApi<ChatMessage[]>(
    sessionId ? `/api/conversations/${sessionId}/messages` : "",
    []
  );
}
