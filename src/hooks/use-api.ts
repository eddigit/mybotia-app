"use client";

import { useState, useEffect } from "react";
import type { Client, Project, Task, Agent, Deal, Activity, Metric } from "@/types";

// Generic fetcher with fallback
function useApi<T>(url: string, fallback: T): { data: T; loading: boolean; error: string | null } {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
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

    return () => { cancelled = true; };
  }, [url]);

  return { data, loading, error };
}

// --- Typed hooks ---

export function useClients() {
  return useApi<Client[]>("/api/clients", []);
}

export function useClient(id: string) {
  return useApi<{
    client: Client;
    contacts: { id: string; name: string; email: string | null; phone: string | null; role: string | null }[];
    activities: Activity[];
    invoices: { id: string; ref: string; total: number; status: string }[];
  } | null>(`/api/clients/${id}`, null);
}

export function useProjects() {
  return useApi<Project[]>("/api/projects", []);
}

export function useTasks() {
  return useApi<Task[]>("/api/tasks", []);
}

export function useAgents() {
  return useApi<Agent[]>("/api/agents", []);
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
