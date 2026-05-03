"use client";

// Bloc 5C-fix — Cockpit Aujourd'hui MyBotIA STRICT.
// Doctrine produit : cette page est le cockpit personnel quotidien de Gilles.
// Elle n'est PAS multi-tenant. Le serveur force tenant=mybotia (cf /api/today).
// Aucun filtre tenant n'est exposé côté UI.

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  Sun,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Briefcase,
  Receipt,
  FileText,
  Activity as ActivityIcon,
  ShieldAlert,
  Clock,
  Loader2,
  Plus,
} from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { btnPrimary } from "@/components/shared/FormModal";
import { TaskEditPanel } from "@/components/tasks/TaskEditPanel";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import type {
  TaskItem,
  DashboardProposal,
  DashboardInvoice,
} from "@/hooks/use-api";
import type { Deal, Activity } from "@/types";
import { formatCurrency, cn } from "@/lib/utils";

interface TodayPayload {
  tenant: string;
  tasks: TaskItem[];
  deals: Deal[];
  proposals: DashboardProposal[];
  invoices: DashboardInvoice[];
  activities: Activity[];
}

const PRIO_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysSince(dateISO?: string): number {
  if (!dateISO) return 0;
  const ms = new Date(todayISO()).getTime() - new Date(dateISO).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

export default function TodayPage() {
  const [payload, setPayload] = useState<TodayPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchToday = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/today");
      if (res.ok) setPayload(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchToday();
  }, [fetchToday]);

  const today = todayISO();

  const todayTasks = useMemo(() => {
    if (!payload) return [];
    return payload.tasks
      .filter((t) => t.status !== "done" && t.dueDate === today)
      .sort((a, b) => (PRIO_RANK[b.priority] || 0) - (PRIO_RANK[a.priority] || 0));
  }, [payload, today]);

  const lateTasks = useMemo(() => {
    if (!payload) return [];
    return payload.tasks
      .filter((t) => t.status !== "done" && t.dueDate && t.dueDate < today)
      .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
  }, [payload, today]);

  const activeDeals = useMemo(() => {
    if (!payload) return [];
    return payload.deals
      .filter((d) => ["discovery", "proposal", "negotiation", "closing"].includes(d.stage))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [payload]);

  const proposalsToFollow = useMemo(() => {
    if (!payload) return [];
    return payload.proposals
      .filter((p) => p.status === "draft" || p.status === "validated")
      .sort((a, b) => b.total - a.total);
  }, [payload]);

  const invoicesToFollow = useMemo(() => {
    if (!payload) return [];
    return payload.invoices
      .filter((inv) => inv.status === "late" || inv.status === "sent")
      .sort((a, b) => (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0));
  }, [payload]);

  const activities = useMemo(
    () => (payload?.activities ?? []).slice(0, 10),
    [payload]
  );

  const alerts = useMemo(() => {
    if (!payload) return [];
    const out: Array<{ id: string; type: string; label: string; severity: "high" | "medium" }> = [];
    for (const t of payload.tasks) {
      if (t.status !== "done" && t.dueDate && t.dueDate < today && t.priority === "critical") {
        out.push({
          id: `t-${t.id}`,
          type: "Tâche critique en retard",
          label: `${t.title} · ${daysSince(t.dueDate)}j retard`,
          severity: "high",
        });
      }
    }
    for (const d of payload.deals) {
      if (!d.clientName || d.clientName === "(client inconnu)" || d.clientName === "") {
        out.push({
          id: `d-${d.id}`,
          type: "Affaire sans client",
          label: `${d.title} · ${formatCurrency(d.value)}`,
          severity: "medium",
        });
      }
    }
    for (const inv of payload.invoices) {
      if (!inv.clientName) {
        out.push({
          id: `i-${inv.id}`,
          type: "Facture sans client",
          label: `${inv.ref} · ${formatCurrency(inv.total)}`,
          severity: "high",
        });
      }
    }
    for (const p of payload.proposals) {
      if (!p.clientName) {
        out.push({
          id: `p-${p.id}`,
          type: "Devis sans client",
          label: `${p.ref} · ${formatCurrency(p.total)}`,
          severity: "medium",
        });
      }
    }
    return out.slice(0, 8);
  }, [payload, today]);

  const kpis = [
    { label: "Aujourd'hui", value: todayTasks.length, hint: "tâches du jour", href: "#priorites" },
    { label: "En retard", value: lateTasks.length, hint: "à reprendre", href: "#retards" },
    {
      label: "Affaires",
      value: activeDeals.length,
      hint: `${formatCurrency(activeDeals.reduce((s, d) => s + d.value, 0))} pipeline`,
      href: "/pipeline",
    },
    {
      label: "Paiements",
      value: invoicesToFollow.length + proposalsToFollow.length,
      hint: "à suivre",
      href: "#paiements",
    },
  ];

  async function markDone(t: TaskItem) {
    if (completing) return;
    setCompleting(t.id);
    try {
      // Bloc 5G-bis : hostname → tenant côté serveur.
      const res = await fetch(`/api/tasks/${encodeURIComponent(t.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress: "100" }),
      });
      if (res.ok) await fetchToday();
    } finally {
      setCompleting(null);
    }
  }

  if (loading) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-accent-glow" />
      </div>
    );
  }

  return (
    <div className="p-8 min-h-screen space-y-6">
      <ModuleHeader
        icon={Sun}
        title="Aujourd'hui — Cockpit quotidien MyBotIA"
        subtitle="Tâches, affaires, paiements et flux du jour"
        actions={
          <button onClick={() => setShowCreate(true)} className={btnPrimary}>
            <Plus className="w-3.5 h-3.5" />
            Nouvelle tâche
          </button>
        }
      />

      {/* KPI strip cliquable */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Link
            key={k.label}
            href={k.href}
            className="card-sharp-high p-5 hover:bg-surface-2/50 transition-colors block"
          >
            <span className="micro-label text-text-muted">{k.label}</span>
            <p className="text-2xl font-headline font-extrabold text-text-primary mt-2">{k.value}</p>
            <p className="text-[10px] text-text-muted mt-1">{k.hint}</p>
          </Link>
        ))}
      </div>

      {/* === A. Priorités du jour === */}
      <section id="priorites" className="card-sharp p-6">
        <SectionHeader icon={Circle} title="Priorités du jour" count={todayTasks.length} />
        {todayTasks.length === 0 ? (
          <EmptyHint text="Aucune tâche d'échéance aujourd'hui." />
        ) : (
          <div className="divide-y divide-border-subtle">
            {todayTasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                onMarkDone={() => markDone(t)}
                onOpen={() => setSelectedTask(t)}
                completing={completing === t.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* === B. En retard === */}
      <section id="retards" className="card-sharp p-6">
        <SectionHeader icon={AlertTriangle} title="En retard" count={lateTasks.length} accent="text-status-danger" />
        {lateTasks.length === 0 ? (
          <EmptyHint text="Aucune tâche en retard. Beau travail." />
        ) : (
          <div className="divide-y divide-border-subtle">
            {lateTasks.map((t) => (
              <TaskRow
                key={`late-${t.id}`}
                task={t}
                onMarkDone={() => markDone(t)}
                onOpen={() => setSelectedTask(t)}
                completing={completing === t.id}
                lateInfo={`${daysSince(t.dueDate)} j de retard`}
              />
            ))}
          </div>
        )}
      </section>

      {/* === C. Affaires en cours === */}
      <section id="affaires" className="card-sharp p-6">
        <SectionHeader icon={Briefcase} title="Affaires en cours" count={activeDeals.length} />
        {activeDeals.length === 0 ? (
          <EmptyHint text="Aucune opportunité ouverte." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeDeals.map((d) => (
              <Link
                key={d.id}
                href={d.clientId ? `/crm/${encodeURIComponent(d.clientId)}` : "/pipeline"}
                className="p-3 bg-surface-2/50 hover:bg-surface-2 border border-border-subtle transition-colors block"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-xs font-bold text-text-primary truncate flex-1">{d.title}</p>
                  <span className="text-[10px] text-accent-glow font-mono uppercase shrink-0">{d.stage}</span>
                </div>
                <p className="text-[10px] text-text-muted truncate">{d.clientName || "(sans client)"}</p>
                <p className="text-sm font-headline font-extrabold text-text-primary mt-1">{formatCurrency(d.value)}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* === D. Paiements à suivre === */}
      <section id="paiements" className="card-sharp p-6 space-y-4">
        <SectionHeader
          icon={Receipt}
          title="Paiements à suivre"
          count={proposalsToFollow.length + invoicesToFollow.length}
        />
        {invoicesToFollow.length > 0 && (
          <div>
            <h4 className="micro-label text-text-muted mb-2">Factures ({invoicesToFollow.length})</h4>
            <div className="space-y-1.5">
              {invoicesToFollow.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between gap-3 p-2 bg-surface-2/50 border border-border-subtle text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Receipt className="w-3 h-3 text-text-muted shrink-0" />
                    <span className="font-mono font-bold text-text-primary truncate">{inv.ref}</span>
                    <span className="text-text-muted truncate">{inv.clientName || "(sans client)"}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {inv.status === "late" && (
                      <span className="text-[10px] text-status-danger font-bold uppercase">{inv.daysOverdue}j retard</span>
                    )}
                    <span className="text-text-secondary font-semibold">{formatCurrency(inv.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {proposalsToFollow.length > 0 && (
          <div>
            <h4 className="micro-label text-text-muted mb-2">
              Devis envoyés ou en cours ({proposalsToFollow.length})
            </h4>
            <div className="space-y-1.5">
              {proposalsToFollow.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 p-2 bg-surface-2/50 border border-border-subtle text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileText className="w-3 h-3 text-text-muted shrink-0" />
                    <span className="font-mono font-bold text-text-primary truncate">{p.ref}</span>
                    <span className="text-text-muted truncate">{p.clientName || "(sans client)"}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] text-text-muted uppercase">{p.status}</span>
                    <span className="text-text-secondary font-semibold">{formatCurrency(p.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {proposalsToFollow.length === 0 && invoicesToFollow.length === 0 && (
          <EmptyHint text="Aucun paiement ou devis à suivre." />
        )}
      </section>

      {/* === E. Flux intelligence === */}
      <section id="flux" className="card-sharp p-6">
        <SectionHeader icon={ActivityIcon} title="Flux récent" count={activities.length} />
        {activities.length === 0 ? (
          <EmptyHint text="Aucun événement récent." />
        ) : (
          <div className="divide-y divide-border-subtle">
            {activities.map((a) => (
              <div key={a.id} className="py-2.5 flex items-start gap-3">
                <Clock className="w-3 h-3 text-text-muted mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">{a.title}</p>
                  {a.clientName && <p className="text-[10px] text-text-muted">{a.clientName}</p>}
                </div>
                <span className="text-[10px] text-text-muted font-mono shrink-0">
                  {new Date(a.timestamp).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* === F. Alertes === */}
      <section id="alertes" className="card-sharp p-6">
        <SectionHeader icon={ShieldAlert} title="Alertes" count={alerts.length} accent="text-amber-300" />
        {alerts.length === 0 ? (
          <EmptyHint text="Aucune anomalie détectée. Tout est cohérent." />
        ) : (
          <div className="divide-y divide-border-subtle">
            {alerts.map((al) => (
              <div key={al.id} className="py-2.5 flex items-center gap-3">
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    al.severity === "high" ? "bg-status-danger" : "bg-amber-400"
                  )}
                />
                <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold w-44 shrink-0">
                  {al.type}
                </span>
                <span className="text-xs text-text-secondary truncate flex-1">{al.label}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Drawer détail tâche */}
      <TaskEditPanel
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onSaved={() => fetchToday()}
      />

      {/* Modal création tâche (tenant_slug=mybotia forcé) */}
      <CreateTaskModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => fetchToday()}
        tenantSlug="mybotia"
      />
    </div>
  );
}

// ── helpers UI inline ──────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  count,
  accent = "text-accent-glow",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count: number;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon className={cn("w-4 h-4", accent)} />
        <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
          {title}
        </h2>
      </div>
      <span className="micro-label text-text-muted font-mono">{count}</span>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="text-xs text-text-muted italic">{text}</p>;
}

function TaskRow({
  task,
  onMarkDone,
  onOpen,
  completing,
  lateInfo,
}: {
  task: TaskItem;
  onMarkDone: () => void;
  onOpen: () => void;
  completing: boolean;
  lateInfo?: string;
}) {
  const prioColor =
    task.priority === "critical"
      ? "text-status-danger bg-status-danger/10 border-status-danger/30"
      : task.priority === "high"
      ? "text-amber-300 bg-amber-400/10 border-amber-400/30"
      : task.priority === "medium"
      ? "text-blue-300 bg-blue-500/10 border-blue-500/30"
      : "text-text-muted bg-surface-3/50 border-border-subtle";

  return (
    <div className="py-2.5 flex items-center gap-3">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onMarkDone();
        }}
        disabled={completing}
        title="Marquer terminée"
        className="text-text-muted hover:text-emerald-400 transition-colors disabled:opacity-50 shrink-0"
      >
        {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="flex-1 min-w-0 text-left hover:bg-surface-2/50 -mx-2 px-2 py-1 transition-colors"
        title="Ouvrir le détail"
      >
        <p className="text-sm text-text-primary truncate">{task.title}</p>
        <p className="text-[10px] text-text-muted truncate">
          {task.projectName || "(sans projet)"}
          {task.dueDate && ` · ${task.dueDate}`}
        </p>
      </button>
      {lateInfo && (
        <span className="text-[10px] text-status-danger font-bold uppercase shrink-0">{lateInfo}</span>
      )}
      <span
        className={cn(
          "inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tight border shrink-0",
          prioColor
        )}
      >
        {task.priority}
      </span>
    </div>
  );
}
