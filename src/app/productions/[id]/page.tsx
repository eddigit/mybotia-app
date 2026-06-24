"use client";

// V1.1.D Phase 2 — Fiche détail production.
//
// Endpoints consommés :
//   - GET   /api/productions/[id]                    → header + métadonnées
//   - GET   /api/productions/[id]/subscriptions      → bloc revenus récurrent
//   - GET   /api/productions/[id]/invoices           → bloc factures
//   - PATCH /api/productions/[id]                    → modale édition
//   - POST  /api/productions/[id]/subscriptions      → modale "+ abonnement"
//   - GET   /api/clients?id=...                      → résolution nom client
//
// Doctrine app.mybotia = parité CRM (doctrine_app_mybotia_parite_crm) :
//   - aucun mock, empty states actionnables
//   - DEUX colonnes revenus obligatoires (one-shot HT + récurrent), même à 0 €
//   - dates FR, montants FR, mobile responsive

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Hammer,
  Loader2,
  AlertTriangle,
  Pencil,
  Archive,
  FilePlus,
  Plus,
  ExternalLink,
  PackageOpen,
  Download,
  CheckSquare,
} from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { FeatureDisabled } from "@/components/shared/FeatureDisabled";
import { useCockpitFeatures, useScopedClients } from "@/hooks/use-api";
import type { TaskItem } from "@/hooks/use-api";
import { EditProductionModal } from "@/components/productions/EditProductionModal";
import { AddSubscriptionModal } from "@/components/productions/AddSubscriptionModal";
import { CreateInvoiceFromProductionModal } from "@/components/productions/CreateInvoiceFromProductionModal";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { cn } from "@/lib/utils";

const STAGE_LABEL: Record<string, string> = {
  active: "En cours",
  paused: "En pause",
  done: "Livré",
  cancelled: "Annulé",
  abandoned: "Abandonné",
};

const STAGE_COLOR: Record<string, string> = {
  active: "bg-accent-primary/15 text-accent-glow border-accent-primary/30",
  paused: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  cancelled: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  abandoned: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
};

const BILLING_LABEL: Record<string, string> = {
  one_shot: "One-shot",
  recurring: "Récurrent",
  mixed: "Mixte",
};

const BILLING_COLOR: Record<string, string> = {
  one_shot: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  recurring: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  mixed: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
};

const CYCLE_LABEL: Record<string, string> = {
  monthly: "Mensuel",
  quarterly: "Trimestriel",
  yearly: "Annuel",
};

const SUB_STATUS_LABEL: Record<string, string> = {
  active: "Actif",
  paused: "En pause",
  ended: "Terminé",
  cancelled: "Annulé",
};

const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoyée",
  paid: "Payée",
  overdue: "En retard",
  cancelled: "Annulée",
};

const TASK_STATUS_LABEL: Record<string, string> = {
  todo: "À faire",
  in_progress: "En cours",
  done: "Terminée",
  blocked: "Bloquée",
  cancelled: "Annulée",
};

const TASK_STATUS_COLOR: Record<string, string> = {
  todo: "bg-surface-3/60 text-text-muted border-border-subtle",
  in_progress: "bg-accent-primary/15 text-accent-glow border-accent-primary/30",
  done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  blocked: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  cancelled: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
};

type ProductionRow = {
  id: string;
  tenantId?: string;
  tenant_id?: string;
  clientId?: string;
  client_id?: string;
  name?: string;
  title?: string;
  description?: string | null;
  status: string;
  lifecycleStage?: string;
  lifecycle_stage?: string;
  dueDate?: string | null;
  due_date?: string | null;
  priority?: string | null;
  nextAction?: string | null;
  next_action?: string | null;
  ownerUserId?: string | null;
  owner_user_id?: string | null;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  /** Présent si la vue business_productions est jointe côté biz (futur). */
  oneshotAmountHt?: string | number;
  oneshot_amount_ht?: string | number;
};

type SubscriptionRow = {
  id: string;
  label: string | null;
  status: string;
  monthly_amount: string;
  billing_period: string;
  start_date: string | null;
  end_date: string | null;
  client_name?: string | null;
};

type InvoiceRow = {
  id: string;
  number?: string;
  reference?: string;
  status: string;
  totalTtc?: string | number;
  total_ttc?: string | number;
  issuedAt?: string | null;
  issued_at?: string | null;
  createdAt?: string;
  created_at?: string;
};

const fmtMoney = (n: number) =>
  n.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

const fmtDate = (s: string | null | undefined) => {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("fr-FR");
  } catch {
    return s;
  }
};

function safeNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function productionTitle(p: ProductionRow): string {
  return p.title || p.name || "(sans titre)";
}

export default function ProductionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: cockpitFeatures, loading: featuresLoading } =
    useCockpitFeatures();
  const productionsEnabled =
    cockpitFeatures?.features?.productions === true;
  // Toujours business : les routes /api/productions/* renvoient 501 sinon.
  const isBusiness = true;

  const [production, setProduction] = useState<ProductionRow | null>(null);
  const [subs, setSubs] = useState<SubscriptionRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [showEdit, setShowEdit] = useState(false);
  const [showAddSub, setShowAddSub] = useState(false);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const { data: clients } = useScopedClients();
  const clientLookup = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clients) m.set(c.id, c.name || c.company || "");
    return m;
  }, [clients]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/productions/${encodeURIComponent(id)}`).then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j?.error || `production_http_${r.status}`);
        }
        return (await r.json()) as ProductionRow;
      }),
      fetch(`/api/productions/${encodeURIComponent(id)}/subscriptions`).then(
        async (r) => {
          if (!r.ok) return [] as SubscriptionRow[];
          return (await r.json()) as SubscriptionRow[];
        },
      ),
      fetch(`/api/productions/${encodeURIComponent(id)}/invoices`).then(
        async (r) => {
          if (!r.ok) return [] as InvoiceRow[];
          return (await r.json()) as InvoiceRow[];
        },
      ),
      fetch(`/api/tasks?projectId=${encodeURIComponent(id)}`).then(async (r) => {
        if (!r.ok) return [] as TaskItem[];
        return (await r.json()) as TaskItem[];
      }),
    ])
      .then(([prod, subRows, invRows, taskRows]) => {
        if (cancelled) return;
        setProduction(prod);
        setSubs(Array.isArray(subRows) ? subRows : []);
        setInvoices(Array.isArray(invRows) ? invRows : []);
        setTasks(Array.isArray(taskRows) ? taskRows : []);
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
  }, [id, tick]);

  const refetch = () => setTick((t) => t + 1);

  // Doctrine revenus mixtes : MRR HT calculé temps réel depuis subs actives
  // monthly. yearly/quarterly contribuent à l'ARR mais pas au MRR pur.
  const mrrHt = useMemo(() => {
    return subs
      .filter(
        (s) =>
          s.status === "active" &&
          s.billing_period === "monthly" &&
          (!s.end_date || new Date(s.end_date) > new Date()),
      )
      .reduce((acc, s) => acc + safeNumber(s.monthly_amount), 0);
  }, [subs]);

  // billing_mode dérivé : pas persisté en colonne (cf. projects-raw.ts).
  const billingMode = useMemo<"one_shot" | "recurring" | "mixed">(() => {
    const oneshot = safeNumber(
      production?.oneshotAmountHt ?? production?.oneshot_amount_ht ?? 0,
    );
    const hasRecurring = subs.some((s) => s.status === "active");
    if (hasRecurring && oneshot > 0) return "mixed";
    if (hasRecurring) return "recurring";
    return "one_shot";
  }, [subs, production]);

  async function handleArchive() {
    if (!production) return;
    if (
      !confirm(
        "Archiver cette production ? Le statut passera à \"abandonné\" (soft-delete réversible).",
      )
    )
      return;
    setArchiving(true);
    try {
      const res = await fetch(
        `/api/productions/${encodeURIComponent(production.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "abandoned" }),
        },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(`Erreur archivage : ${j?.error || res.status}`);
        return;
      }
      refetch();
    } finally {
      setArchiving(false);
    }
  }

  if (!featuresLoading && cockpitFeatures && !productionsEnabled) {
    return (
      <FeatureDisabled
        featureKey="productions"
        tenantSlug={cockpitFeatures.tenant}
      />
    );
  }

  if (loading) {
    return (
      <div className="p-8 min-h-screen">
        <BackLink />
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-accent-glow" />
        </div>
      </div>
    );
  }

  if (error || !production) {
    return (
      <div className="p-8 min-h-screen space-y-4">
        <BackLink />
        <div className="card-sharp p-5 flex items-start gap-3 text-sm border-amber-400/30 bg-amber-400/5 text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Production introuvable</p>
            <p className="text-[12px] mt-1 text-amber-200/80">
              {error || "La production demandée n'existe pas ou n'est pas accessible."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const clientId = production.clientId ?? production.client_id ?? "";
  const clientName =
    (clientId && clientLookup.get(clientId)) ||
    (subs.find((s) => s.client_name)?.client_name ?? "");
  const dueDate = production.dueDate ?? production.due_date ?? null;
  const createdAt = production.createdAt ?? production.created_at ?? null;
  const ownerUserId =
    production.ownerUserId ?? production.owner_user_id ?? null;
  const oneshotHt = safeNumber(
    production.oneshotAmountHt ?? production.oneshot_amount_ht ?? 0,
  );

  return (
    <div className="p-4 sm:p-8 min-h-screen space-y-6">
      <BackLink />

      {/* Header : titre + status + billing_mode + actions */}
      <div className="card-sharp p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-3 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  "px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tight border shrink-0",
                  STAGE_COLOR[production.status] ??
                    "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
                )}
              >
                {STAGE_LABEL[production.status] ?? production.status}
              </span>
              <span
                className={cn(
                  "px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tight border shrink-0",
                  BILLING_COLOR[billingMode],
                )}
              >
                {BILLING_LABEL[billingMode]}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Hammer className="w-5 h-5 text-accent-glow shrink-0" />
              <h1 className="text-xl sm:text-2xl font-bold font-headline text-text-primary truncate">
                {productionTitle(production)}
              </h1>
            </div>
            {production.description ? (
              <p className="text-[12px] text-text-muted leading-relaxed whitespace-pre-wrap max-w-3xl">
                {production.description}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowEdit(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold uppercase tracking-tight border border-border-subtle bg-surface-2 text-text-primary hover:bg-surface-3"
            >
              <Pencil className="w-3.5 h-3.5" />
              Modifier
            </button>
            <button
              onClick={handleArchive}
              disabled={archiving || production.status === "abandoned"}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold uppercase tracking-tight border border-border-subtle bg-surface-2 text-text-primary hover:bg-surface-3 disabled:opacity-50"
            >
              {archiving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Archive className="w-3.5 h-3.5" />
              )}
              Archiver
            </button>
            <button
              onClick={() => setShowCreateInvoice(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold uppercase tracking-tight border border-accent-primary/30 bg-accent-primary/10 text-accent-glow hover:bg-accent-primary/20"
            >
              <FilePlus className="w-3.5 h-3.5" />
              Créer facture
            </button>
          </div>
        </div>
      </div>

      {/* Métadonnées */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetaCard label="Client">
          {clientId ? (
            <Link
              href={`/crm/${encodeURIComponent(clientId)}`}
              className="text-sm font-medium text-accent-glow hover:underline inline-flex items-center gap-1"
            >
              {clientName || clientId}
              <ExternalLink className="w-3 h-3" />
            </Link>
          ) : (
            <span className="text-sm text-text-muted">—</span>
          )}
        </MetaCard>
        <MetaCard label="Affaire d'origine">
          <Link
            href={`/affaires/${encodeURIComponent(production.id)}`}
            className="text-sm font-medium text-accent-glow hover:underline inline-flex items-center gap-1"
            title="L'affaire et la production partagent le même project.id (V1.1.D)."
          >
            Voir l&apos;historique
            <ExternalLink className="w-3 h-3" />
          </Link>
        </MetaCard>
        <MetaCard label="Date de début">
          <span className="text-sm font-medium text-text-primary tabular-nums">
            {fmtDate(createdAt)}
          </span>
        </MetaCard>
        <MetaCard label="Livraison prévue">
          <span className="text-sm font-medium text-text-primary tabular-nums">
            {fmtDate(dueDate)}
          </span>
        </MetaCard>
        <MetaCard label="Owner">
          <span className="text-sm font-medium text-text-primary truncate">
            {ownerUserId || "—"}
          </span>
        </MetaCard>
        <MetaCard label="Prochaine action">
          <span className="text-sm text-text-primary truncate">
            {production.nextAction ?? production.next_action ?? "—"}
          </span>
        </MetaCard>
      </section>

      {/* Tâches liées */}
      <section className="card-sharp p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-accent-glow" />
            <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
              Tâches de production
            </h2>
            <span className="text-[10px] text-text-muted font-mono tabular-nums">
              {tasks.length}
            </span>
          </div>
          <button
            onClick={() => setShowCreateTask(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-tight border border-accent-primary/30 bg-accent-primary/10 text-accent-glow hover:bg-accent-primary/20"
          >
            <Plus className="w-3 h-3" />
            Nouvelle tâche
          </button>
        </div>

        {tasks.length === 0 ? (
          <div className="py-4 text-[12px] text-text-muted leading-relaxed">
            Aucune tâche rattachée à cette production.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-tight text-text-muted">
                  <th className="px-2 py-2 font-semibold">Tâche</th>
                  <th className="px-2 py-2 font-semibold">Statut</th>
                  <th className="px-2 py-2 font-semibold">Échéance</th>
                  <th className="px-2 py-2 font-semibold">Priorité</th>
                  <th className="px-2 py-2 font-semibold">Assigné</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {tasks.map((task) => (
                  <tr key={task.id}>
                    <td className="px-2 py-2 text-text-primary font-medium max-w-[360px]">
                      <span className="line-clamp-2">{task.title}</span>
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tight border whitespace-nowrap",
                          TASK_STATUS_COLOR[task.status] ??
                            TASK_STATUS_COLOR.todo,
                        )}
                      >
                        {TASK_STATUS_LABEL[task.status] ?? task.status}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-text-muted tabular-nums">
                      {fmtDate(task.dueDate)}
                    </td>
                    <td className="px-2 py-2 text-text-muted capitalize">
                      {task.priority || "—"}
                    </td>
                    <td className="px-2 py-2 text-text-muted">
                      {task.assigneeName || task.assignedTo || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Bloc revenus mixtes — DEUX colonnes obligatoires */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* One-shot HT */}
        <div className="card-sharp p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
              One-shot HT
            </h2>
            <span className="text-[10px] text-text-muted font-mono">EUR</span>
          </div>
          <div className="text-3xl font-bold tabular-nums text-text-primary">
            {fmtMoney(oneshotHt)}
          </div>
          <p className="text-[11px] text-text-muted leading-relaxed">
            Montant figé à la signature de l&apos;affaire (somme des devis acceptés).
            La date d&apos;encaissement suit le statut des factures émises.
          </p>
        </div>

        {/* Récurrent */}
        <div className="card-sharp p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
              Récurrent — MRR HT
            </h2>
            <span className="text-[10px] text-text-muted font-mono tabular-nums">
              {fmtMoney(mrrHt)}/mois
            </span>
          </div>

          {subs.length === 0 ? (
            <div className="py-3 text-[11px] text-text-muted leading-relaxed">
              Aucun abonnement actif sur cette production.
            </div>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-tight text-text-muted">
                    <th className="px-1 py-1.5 font-semibold">Libellé</th>
                    <th className="px-1 py-1.5 font-semibold text-right">MRR HT</th>
                    <th className="px-1 py-1.5 font-semibold">Cycle</th>
                    <th className="px-1 py-1.5 font-semibold">Début</th>
                    <th className="px-1 py-1.5 font-semibold">Fin</th>
                    <th className="px-1 py-1.5 font-semibold">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {subs.map((s) => (
                    <tr key={s.id}>
                      <td className="px-1 py-2 text-text-primary truncate max-w-[180px]">
                        {s.label || "—"}
                      </td>
                      <td className="px-1 py-2 text-right tabular-nums text-text-primary">
                        {fmtMoney(safeNumber(s.monthly_amount))}
                      </td>
                      <td className="px-1 py-2 text-text-muted">
                        {CYCLE_LABEL[s.billing_period] ?? s.billing_period}
                      </td>
                      <td className="px-1 py-2 text-text-muted tabular-nums">
                        {fmtDate(s.start_date)}
                      </td>
                      <td className="px-1 py-2 text-text-muted tabular-nums">
                        {fmtDate(s.end_date)}
                      </td>
                      <td className="px-1 py-2">
                        <span
                          className={cn(
                            "px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tight border",
                            s.status === "active"
                              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                              : "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
                          )}
                        >
                          {SUB_STATUS_LABEL[s.status] ?? s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            onClick={() => setShowAddSub(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold uppercase tracking-tight border border-accent-primary/30 bg-accent-primary/10 text-accent-glow hover:bg-accent-primary/20"
          >
            <Plus className="w-3.5 h-3.5" />
            Nouvel abonnement
          </button>
        </div>
      </section>

      {/* Bloc factures */}
      <section className="card-sharp p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
            Factures émises
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-muted font-mono tabular-nums">
              {invoices.length}
            </span>
            <button
              onClick={() => setShowCreateInvoice(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-tight border border-accent-primary/30 bg-accent-primary/10 text-accent-glow hover:bg-accent-primary/20"
            >
              <Plus className="w-3 h-3" />
              Nouvelle facture
            </button>
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className="text-center py-6 space-y-3">
            <div className="inline-flex items-center justify-center w-10 h-10 mx-auto bg-accent-primary/10 border border-accent-primary/30">
              <PackageOpen className="w-4 h-4 text-accent-glow" />
            </div>
            <p className="text-[12px] text-text-muted leading-relaxed max-w-md mx-auto">
              Aucune facture émise pour cette production.
            </p>
            <button
              onClick={() => setShowCreateInvoice(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold uppercase tracking-tight border border-accent-primary/30 bg-accent-primary/10 text-accent-glow hover:bg-accent-primary/20"
            >
              <FilePlus className="w-3.5 h-3.5" />
              Émettre la première facture
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-tight text-text-muted">
                  <th className="px-2 py-2 font-semibold">Numéro</th>
                  <th className="px-2 py-2 font-semibold">Date</th>
                  <th className="px-2 py-2 font-semibold text-right">
                    Total TTC
                  </th>
                  <th className="px-2 py-2 font-semibold">Statut</th>
                  <th className="px-2 py-2 font-semibold text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {invoices.map((inv) => {
                  const number = inv.number ?? inv.reference ?? inv.id.slice(0, 8);
                  const totalTtc = safeNumber(inv.totalTtc ?? inv.total_ttc);
                  const issuedAt =
                    inv.issuedAt ?? inv.issued_at ?? inv.createdAt ?? inv.created_at;
                  return (
                    <tr key={inv.id}>
                      <td className="px-2 py-2 text-text-primary font-mono">
                        {number}
                      </td>
                      <td className="px-2 py-2 text-text-muted tabular-nums">
                        {fmtDate(issuedAt)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-text-primary">
                        {fmtMoney(totalTtc)}
                      </td>
                      <td className="px-2 py-2">
                        <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tight border border-border-subtle bg-surface-2 text-text-primary">
                          {INVOICE_STATUS_LABEL[inv.status] ?? inv.status}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          {isBusiness && (
                            <a
                              href={`/api/invoices/${encodeURIComponent(inv.id)}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-accent-glow hover:underline text-[11px] font-medium inline-flex items-center gap-1"
                              title="Télécharger le PDF Premium"
                            >
                              <Download className="w-3 h-3" />
                              PDF
                            </a>
                          )}
                          <Link
                            href={`/documents/facture/${encodeURIComponent(inv.id)}`}
                            className="text-accent-glow hover:underline text-[11px] font-medium inline-flex items-center gap-1"
                          >
                            Voir
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <EditProductionModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onSaved={refetch}
        production={production}
      />
      <AddSubscriptionModal
        open={showAddSub}
        onClose={() => setShowAddSub(false)}
        onSaved={refetch}
        productionId={production.id}
      />
      <CreateInvoiceFromProductionModal
        open={showCreateInvoice}
        onClose={() => setShowCreateInvoice(false)}
        productionId={production.id}
        productionTitle={productionTitle(production)}
        clientId={clientId}
        clientName={clientName}
        oneshotHt={oneshotHt}
        subscriptions={subs}
      />
      <CreateTaskModal
        open={showCreateTask}
        onClose={() => setShowCreateTask(false)}
        onCreated={() => {
          setShowCreateTask(false);
          refetch();
        }}
        tenantSlug={cockpitFeatures?.tenant ?? "mybotia"}
        defaultProjectId={production.id}
        defaultProjectLabel={productionTitle(production)}
        lockProject
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/productions"
      className="inline-flex items-center gap-1 text-[12px] text-text-muted hover:text-text-primary mb-2"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      Productions
    </Link>
  );
}

function MetaCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-sharp p-4 space-y-1">
      <div className="text-[9px] font-bold uppercase tracking-widest text-text-muted">
        {label}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// V1.1.D — page header simple. La <ModuleHeader> n'est pas réutilisée ici
// car la fiche détail a son propre layout (titre + actions inline).
void ModuleHeader;
