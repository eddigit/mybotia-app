"use client";

import { useState, useEffect, useCallback } from "react";
import type { Client, Project, Agent, Deal, Activity, Metric } from "@/types";

// V1.1.G — nom canonique de l'event window dispatché par TenantSwitcher
// après une bascule cockpit réussie. Tout hook tenant-dépendant (cockpit
// features, agents, conversations, voice, business scoped) écoute cet event
// et refetch — invalidation cross-domain atomique sans `router.refresh()`
// global qui ne couvre que les Server Components.
export const TENANT_SWITCHED_EVENT = "mybotia:tenant-switched";

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

  // V1.1.G — invalidation cross-domain : tout `useApi` se branche sur l'event
  // `mybotia:tenant-switched` dispatché par `TenantSwitcher`. Toute donnée
  // tenant-dépendante (cockpit features, agents, conversations, scoped
  // business, etc.) est ainsi rafraîchie atomiquement après bascule, sans
  // dépendre uniquement d'un `router.refresh()` qui ne couvre que les Server
  // Components et laisse les caches mémoire des Client Components stale.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => refetch();
    window.addEventListener(TENANT_SWITCHED_EVENT, handler);
    return () => window.removeEventListener(TENANT_SWITCHED_EVENT, handler);
  }, [refetch]);

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
  /** Bloc 3B — true si la source backend ne couvre pas encore tous les domaines
   *  (ex: mybotia_business V1 sans pipeline/activities). Permet aux UI cockpit
   *  d'afficher "—" plutôt que "0" pour ne pas mentir à l'utilisateur. */
  partial?: boolean;
  /** Domaines non encore couverts par la source business (ex: deals_pipeline). */
  missingFeatures?: string[];
  /** Source backend résolue (mybotia_business | dolibarr | external). */
  source?: string;
  /** P0-2 V1.1.H — slug du cockpit résolu par la route (reflète resolveCockpitTenants).
   *  Utilisé par la UI pour afficher le nom du tenant courant dans les KPI. */
  tenant?: string;
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

// ============================================================================
// Bloc 6B — features du cockpit courant (résolu via hostname côté serveur).
// ============================================================================

export interface CockpitFeatures {
  tenant: string;
  displayName: string | null;
  status: string | null;
  profile: string | null;
  features: Record<string, boolean>;
  businessModel: Record<string, unknown> | null;
  isSuperadmin: boolean;
  /** V1.1.E — kind du provider CRM. `mybotia_business` débloque les boutons
   * "PDF Premium" pointant vers /api/quotes/[id]/pdf et /api/invoices/[id]/pdf. */
  crmProvider?: "mybotia_business" | "dolibarr" | "external" | null;
}

export function useCockpitFeatures() {
  return useApi<CockpitFeatures | null>("/api/me/features", null);
}

// ============================================================================
// Bloc 6C — KPI Finance lecture seule
// ============================================================================

export type KpiStatus = "ready" | "partial" | "to_configure" | "error";

export interface FinanceKpi {
  id: string;
  label: string;
  value: number | string | null;
  unit?: string;
  status: KpiStatus;
  note?: string;
}

export interface FinanceKpiSection {
  id: string;
  title: string;
  kpis: FinanceKpi[];
}

export interface FinanceKpiPayload {
  tenant: string;
  displayName: string | null;
  currency: string;
  generatedAt: string;
  sources: {
    dolibarr: "ok" | "error" | "skipped";
    core: "ok" | "error";
    businessModel: "ok" | "missing";
  };
  sections: FinanceKpiSection[];
}

export function useFinanceKpis() {
  return useApi<FinanceKpiPayload | null>("/api/finance/kpis", null);
}

// ============================================================================
// V1.1.D Phase 1 — Affaires / Productions / Finance summary (proxy business)
// ============================================================================

export interface AffaireItem {
  id: string;
  tenantId: string;
  clientId: string;
  title?: string;
  name?: string;
  status: string;
  lifecycleStage?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ProductionItem {
  id: string;
  tenantId: string;
  clientId: string;
  title?: string;
  name?: string;
  status: string;
  lifecycleStage?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export function useAffaires() {
  return useApi<AffaireItem[]>("/api/affaires", []);
}

export function useProductions() {
  return useApi<ProductionItem[]>("/api/productions", []);
}

// ----------------------------------------------------------------------------
// V1.1.D Phase 2 — Affaire detail + quotes liés
// ----------------------------------------------------------------------------

/**
 * AffaireRow = shape réelle renvoyée par mybotia-business (ProjectRow snake_case).
 * Le proxy /api/affaires/[id] dégage le wrapper {data} et retourne tel quel.
 */
export interface AffaireRow {
  id: string;
  tenant_id: string;
  client_id: string;
  name: string;
  description: string | null;
  status: string;
  due_date: string | null;
  project_type: string | null;
  priority: string | null;
  next_action: string | null;
  created_at: string;
  updated_at: string;
  lifecycle_stage: "affaire" | "production";
  [key: string]: unknown;
}

export function useAffaire(id: string | null) {
  return useApi<AffaireRow | null>(id ? `/api/affaires/${id}` : null, null);
}

/**
 * QuoteRow = drizzle shape côté business (camelCase). Proxy /api/quotes
 * filtre par client_id ou status.
 */
export interface QuoteRow {
  id: string;
  tenantId: string;
  clientId: string;
  projectId: string | null;
  number: string;
  status: "draft" | "sent" | "accepted" | "refused" | "cancelled";
  subject: string | null;
  notes: string | null;
  validUntil: string | null;
  subtotalHt: string;
  vatTotal: string;
  totalTtc: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export function useQuotesByClient(clientId: string | null) {
  return useApi<QuoteRow[]>(
    clientId ? `/api/quotes?client_id=${encodeURIComponent(clientId)}` : null,
    [],
  );
}

/**
 * BUG-AG-10 (2026-05-09) — devis strictement liés à une affaire.
 * project_id côté DB = identifiant unique de l'affaire (lifecycle_stage='affaire').
 * Aucun fallback sur client_id : si l'affaire n'a aucun devis lié, retour vide.
 * Différent de `useQuotes({ projectId })` qui fetch toujours, ici null = idle.
 */
export function useQuotesByProject(projectId: string | null) {
  return useApi<QuoteRow[]>(
    projectId
      ? `/api/quotes?project_id=${encodeURIComponent(projectId)}`
      : null,
    [],
  );
}

// ----------------------------------------------------------------------------
// V1.1.F — Devis CRUD côté cockpit app.mybotia.com
// ----------------------------------------------------------------------------

/**
 * Item de devis (ligne). camelCase, drizzle shape côté biz. À la création/
 * modification, on poste seulement label, qty, unitPriceHt, vatRate (+
 * description optionnelle). Le serveur recalcule les line* totals.
 */
export interface QuoteItemRow {
  id?: string;
  quoteId?: string;
  sortOrder?: number;
  label: string;
  description: string | null;
  qty: string | number;
  unitPriceHt: string | number;
  vatRate: string | number;
  lineHt?: string | number;
  lineVat?: string | number;
  lineTtc?: string | number;
}

/**
 * Réponse détail = QuoteRow + items[] inlinés. Le proxy /api/quotes/[id]
 * dégage le wrapper {data} et retourne tel quel.
 */
export interface QuoteDetail extends QuoteRow {
  items: QuoteItemRow[];
}

/** Liste tous les devis du cockpit courant (plus filtres optionnels). */
export function useQuotes(opts?: {
  clientId?: string;
  status?: string;
  projectId?: string;
}) {
  const params = new URLSearchParams();
  if (opts?.clientId) params.set("client_id", opts.clientId);
  if (opts?.status) params.set("status", opts.status);
  if (opts?.projectId) params.set("project_id", opts.projectId);
  const qs = params.toString();
  return useApi<QuoteRow[]>(`/api/quotes${qs ? `?${qs}` : ""}`, []);
}

export function useQuote(id: string | null) {
  return useApi<QuoteDetail | null>(
    id ? `/api/quotes/${encodeURIComponent(id)}` : null,
    null,
  );
}

/** Body POST /api/quotes — passé tel quel à business. */
export interface CreateQuoteBody {
  clientId: string;
  projectId?: string | null;
  subject?: string | null;
  status?: "draft" | "sent" | "accepted" | "refused" | "cancelled";
  notes?: string | null;
  validUntil?: string | null;
  items: Array<{
    label: string;
    description?: string | null;
    qty: number;
    unitPriceHt: number;
    vatRate: number;
  }>;
}

export async function createQuoteApi(
  body: CreateQuoteBody,
): Promise<QuoteDetail> {
  const res = await fetch("/api/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      (typeof json.message === "string" && json.message) ||
      (typeof json.error === "string" && json.error) ||
      `HTTP ${res.status}`;
    throw new Error(message);
  }
  return json as unknown as QuoteDetail;
}

/** Body PATCH partiel — id à part. */
export interface UpdateQuoteBody {
  clientId?: string;
  projectId?: string | null;
  subject?: string | null;
  status?: "draft" | "sent" | "accepted" | "refused" | "cancelled";
  notes?: string | null;
  validUntil?: string | null;
  items?: Array<{
    label: string;
    description?: string | null;
    qty: number;
    unitPriceHt: number;
    vatRate: number;
  }>;
}

export async function updateQuoteApi(
  id: string,
  body: UpdateQuoteBody,
): Promise<QuoteDetail> {
  const res = await fetch(`/api/quotes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      (typeof json.message === "string" && json.message) ||
      (typeof json.error === "string" && json.error) ||
      `HTTP ${res.status}`;
    throw new Error(message);
  }
  return json as unknown as QuoteDetail;
}

export async function deleteQuoteApi(id: string): Promise<void> {
  const res = await fetch(`/api/quotes/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const message =
      (typeof json.message === "string" && json.message) ||
      (typeof json.error === "string" && json.error) ||
      `HTTP ${res.status}`;
    throw new Error(message);
  }
}

/** Conversion devis → facture brouillon. Retourne l'invoice créée. */
export async function convertQuoteToInvoiceApi(
  quoteId: string,
): Promise<{ id: string; number: string; [k: string]: unknown }> {
  const res = await fetch(
    `/api/invoices/from-quote/${encodeURIComponent(quoteId)}`,
    { method: "POST" },
  );
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      (typeof json.message === "string" && json.message) ||
      (typeof json.error === "string" && json.error) ||
      `HTTP ${res.status}`;
    throw new Error(message);
  }
  return json as { id: string; number: string; [k: string]: unknown };
}

// ----------------------------------------------------------------------------
// V1.1.F — Factures CRUD (mêmes patterns que devis).
// Ces hooks sont consommés par /app/invoices et /components/invoices/*.
// Les routes proxy correspondantes existent déjà (V1.1.F invoices route.ts).
// ----------------------------------------------------------------------------

export interface InvoiceItemRow {
  id?: string;
  invoiceId?: string;
  sortOrder?: number;
  label: string;
  description: string | null;
  qty: string | number;
  unitPriceHt?: string | number;
  unit_price_ht?: string | number;
  vatRate?: string | number;
  vat_rate?: string | number;
  lineHt?: string | number;
  lineVat?: string | number;
  lineTtc?: string | number;
  [key: string]: unknown;
}

export interface InvoiceRow {
  id: string;
  tenantId: string;
  clientId: string;
  projectId: string | null;
  quoteId: string | null;
  number: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  subject: string | null;
  notes: string | null;
  issuedAt: string | null;
  dueDate: string | null;
  paidAt?: string | null;
  subtotalHt: string;
  vatTotal: string;
  totalTtc: string;
  createdAt: string;
  updatedAt: string;
  items?: InvoiceItemRow[];
  // Snake_case fallbacks tolérés (compat shape biz si jamais le wrapper
  // sortait du snake_case). Toujours optionnels.
  client_id?: string;
  project_id?: string | null;
  quote_id?: string | null;
  issued_at?: string | null;
  due_date?: string | null;
  paid_at?: string | null;
  subtotal_ht?: string;
  vat_total?: string;
  total_ttc?: string;
  created_at?: string;
  updated_at?: string;
}

export function useInvoices(opts?: {
  clientId?: string;
  status?: string;
  projectId?: string;
}) {
  const params = new URLSearchParams();
  if (opts?.clientId) params.set("client_id", opts.clientId);
  if (opts?.status) params.set("status", opts.status);
  if (opts?.projectId) params.set("project_id", opts.projectId);
  const qs = params.toString();
  return useApi<InvoiceRow[]>(`/api/invoices${qs ? `?${qs}` : ""}`, []);
}

export function useInvoice(id: string | null) {
  return useApi<InvoiceRow | null>(
    id ? `/api/invoices/${encodeURIComponent(id)}` : null,
    null,
  );
}

export interface CreateInvoiceBody {
  clientId: string;
  projectId?: string | null;
  quoteId?: string | null;
  subject?: string | null;
  status?: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  notes?: string | null;
  issuedAt?: string | null;
  dueDate?: string | null;
  items: Array<{
    label: string;
    description?: string | null;
    qty: number;
    unitPriceHt: number;
    vatRate: number;
  }>;
}

export async function createInvoiceApi(
  body: CreateInvoiceBody,
): Promise<InvoiceRow> {
  const res = await fetch("/api/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      (typeof json.message === "string" && json.message) ||
      (typeof json.error === "string" && json.error) ||
      `HTTP ${res.status}`;
    throw new Error(message);
  }
  return json as unknown as InvoiceRow;
}

export interface UpdateInvoiceBody {
  clientId?: string;
  projectId?: string | null;
  subject?: string | null;
  status?: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  notes?: string | null;
  issuedAt?: string | null;
  dueDate?: string | null;
  paidAt?: string | null;
  items?: Array<{
    label: string;
    description?: string | null;
    qty: number;
    unitPriceHt: number;
    vatRate: number;
  }>;
}

export async function updateInvoiceApi(
  id: string,
  body: UpdateInvoiceBody,
): Promise<InvoiceRow> {
  const res = await fetch(`/api/invoices/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      (typeof json.message === "string" && json.message) ||
      (typeof json.error === "string" && json.error) ||
      `HTTP ${res.status}`;
    throw new Error(message);
  }
  return json as unknown as InvoiceRow;
}

export async function deleteInvoiceApi(id: string): Promise<void> {
  const res = await fetch(`/api/invoices/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const message =
      (typeof json.message === "string" && json.message) ||
      (typeof json.error === "string" && json.error) ||
      `HTTP ${res.status}`;
    throw new Error(message);
  }
}

export interface FinanceActiveSubscription {
  id: string;
  production_id: string | null;
  production_title: string | null;
  client_name: string;
  label: string;
  mrr_ht: number;
  billing_cycle: string;
  started_at: string | null;
}

export interface FinanceRecentInvoice {
  id: string;
  number: string;
  client_id: string | null;
  client_name: string | null;
  issued_at: string | null;
  total_ttc: number;
  status: string;
}

export interface FinanceSummary {
  year: number;
  currency: string;
  mrr_active_ht: number;
  arr_active_ht: number;
  oneshot_ytd_ht: number;
  portfolio_total_ht: number;
  by_month: Array<{ month: number; mrr: number; oneshot: number }>;
  active_subscriptions: FinanceActiveSubscription[];
  recent_invoices: FinanceRecentInvoice[];
}

export function useFinanceSummary(year?: number) {
  const url = year
    ? `/api/finance/summary?year=${year}`
    : `/api/finance/summary`;
  return useApi<FinanceSummary | null>(url, null);
}

export interface AdminTenantModule {
  module_key: string;
  name: string;
  category: string;
  version: string;
  depends_on: string[];
  description: string | null;
  status: string;
  enabled: boolean;
  activated_at: string | null;
  deactivated_at: string | null;
  // V1.1.E — config jsonb par tenant (peut être absent sur d'anciennes
  // réponses biz). Toujours objet (jamais null) côté API si présent.
  config?: Record<string, unknown>;
}

export interface AdminTenantModulesResponse {
  data: {
    tenant_slug: string;
    tenant_id: string;
    modules: AdminTenantModule[];
  };
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

