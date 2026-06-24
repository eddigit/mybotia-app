"use client";

// Bloc 5C-fix — Cockpit Aujourd'hui.
// Doctrine produit : cette page est le cockpit personnel quotidien, scopé sur le
// tenant cockpit courant (résolu via hostname côté serveur, cf /api/today + /api/me/features).
// V1.1.H P0-4 : CreateTaskModal suit cockpitFeatures.tenant, plus de hardcode mybotia.

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Sun,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Plus,
  Users,
  CalendarDays,
  ListChecks,
} from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { btnPrimary } from "@/components/shared/FormModal";
import { TaskEditPanel } from "@/components/tasks/TaskEditPanel";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { useCockpitFeatures } from "@/hooks/use-api";
import type { TaskItem } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { formatDateFR } from "@/lib/format";

interface TodayPayload {
  tenant: string;
  tasks: TaskItem[];
}

const PRIO_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const COMMERCE_TASK_KEYS = new Set([
  "acompte",
  "brief",
  "client",
  "commercial",
  "devis",
  "facture",
  "prospection",
  "relance",
  "vente",
]);
const PRODUCTION_TASK_KEYS = new Set([
  "architecture",
  "bug",
  "contenu",
  "deployement",
  "deploiement",
  "design",
  "dev",
  "ia",
  "livraison",
  "maintenance",
  "maquette",
  "recette",
]);

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysSince(dateISO?: string): number {
  if (!dateISO) return 0;
  const ms = new Date(todayISO()).getTime() - new Date(dateISO).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function normalizeTaskSignal(value?: string): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function taskWorkstream(task: TaskItem): {
  label: "Commerce" | "Production" | "Interne";
  className: string;
} {
  const category = normalizeTaskSignal(task.category);
  const workflowStep = normalizeTaskSignal(task.workflowStep);
  const signal = normalizeTaskSignal(
    [task.category, task.workflowStep, task.projectName, task.projectRef, task.title]
      .filter(Boolean)
      .join(" "),
  );
  const hasCommerceSignal =
    COMMERCE_TASK_KEYS.has(category) ||
    COMMERCE_TASK_KEYS.has(workflowStep) ||
    /\b(devis|facture|relance|prospect|pipeline|commercial|vente|acompte)\b/.test(signal);
  const hasProductionSignal =
    PRODUCTION_TASK_KEYS.has(category) ||
    PRODUCTION_TASK_KEYS.has(workflowStep) ||
    /\b(prod|production|livraison|deploy|deploi|recette|bug|maquette|contenu|design|dev|developpement|integration|agent|site)\b/.test(signal);

  if (hasCommerceSignal && !hasProductionSignal) {
    return {
      label: "Commerce",
      className: "border-sky-400/30 bg-sky-500/10 text-sky-300",
    };
  }
  if (hasProductionSignal) {
    return {
      label: "Production",
      className: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
    };
  }
  return {
    label: "Interne",
    className: "border-border-subtle bg-surface-3/60 text-text-muted",
  };
}

const ASSIGNED_TO_LABELS: Record<string, string> = {
  gilles: "Gilles",
  saddjaad: "Saddjaad",
  sajjad: "Saddjaad",
  lea: "Léa",
  damien: "Damien",
  client: "Client",
  autre: "Autre",
};

const COLLABORATOR_ORDER: Record<string, number> = {
  gilles: 0,
  saddjaad: 1,
  sajjad: 1,
  lea: 2,
  damien: 3,
  client: 4,
  autre: 5,
  non_assigne: 99,
};

type TaskCollaboratorGroup = {
  key: string;
  label: string;
  tasks: TaskItem[];
};

function isTodayDate(dateISO?: string): boolean {
  return !!dateISO && dateISO.slice(0, 10) === todayISO();
}

function taskOwner(task: TaskItem): { key: string; label: string; missing: boolean } {
  const assigneeName = task.assigneeName?.trim();
  if (assigneeName) {
    return {
      key: normalizeTaskSignal(assigneeName).replace(/\s+/g, "_") || "non_assigne",
      label: assigneeName,
      missing: false,
    };
  }
  const assignedTo = normalizeTaskSignal(task.assignedTo);
  if (assignedTo) {
    return {
      key: assignedTo,
      label: ASSIGNED_TO_LABELS[assignedTo] ?? task.assignedTo ?? assignedTo,
      missing: false,
    };
  }
  return { key: "non_assigne", label: "Non assigné", missing: true };
}

function groupTasksByCollaborator(tasks: TaskItem[]): TaskCollaboratorGroup[] {
  const groups = new Map<string, TaskCollaboratorGroup>();
  for (const task of tasks) {
    const owner = taskOwner(task);
    const group = groups.get(owner.key) ?? {
      key: owner.key,
      label: owner.label,
      tasks: [],
    };
    group.tasks.push(task);
    groups.set(owner.key, group);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      tasks: group.tasks.sort((a, b) => (PRIO_RANK[b.priority] || 0) - (PRIO_RANK[a.priority] || 0)),
    }))
    .sort((a, b) => {
      const rankA = COLLABORATOR_ORDER[a.key] ?? 50;
      const rankB = COLLABORATOR_ORDER[b.key] ?? 50;
      if (rankA !== rankB) return rankA - rankB;
      return a.label.localeCompare(b.label);
    });
}

export default function TodayPage() {
  // V1.1.H P0-4 — slug cockpit courant pour CreateTaskModal (jamais hardcodé)
  const { data: cockpitFeatures } = useCockpitFeatures();
  const currentTenant = cockpitFeatures?.tenant ?? "mybotia";

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

  const doneTodayTasks = useMemo(() => {
    if (!payload) return [];
    return payload.tasks
      .filter((t) => t.status === "done" && isTodayDate(t.doneAt))
      .sort((a, b) => (b.doneAt || "").localeCompare(a.doneAt || ""));
  }, [payload, today]);

  const planningTasks = useMemo(() => {
    if (!payload) return [];
    return payload.tasks
      .filter((t) => t.status !== "done")
      .filter((t) => !t.dueDate || (taskOwner(t).missing && t.dueDate !== today))
      .sort((a, b) => {
        if (!a.dueDate && b.dueDate) return -1;
        if (a.dueDate && !b.dueDate) return 1;
        return (a.createdAt || "").localeCompare(b.createdAt || "");
      })
      .slice(0, 12);
  }, [payload, today]);

  const tasksByCollaborator = useMemo(
    () => groupTasksByCollaborator(todayTasks),
    [todayTasks],
  );

  // Phase 3B — empty states honnêtes : 0 → "—" + libellé adapté
  // ("Aucun à suivre" plutôt que "0 à suivre").
  const fmtCount = (n: number): string => (n === 0 ? "—" : n.toString());
  const kpis = [
    {
      label: "À reprendre",
      value: fmtCount(lateTasks.length),
      hint: lateTasks.length === 0 ? "Aucun retard" : "en retard",
      href: "#reprendre",
    },
    {
      label: "Aujourd'hui",
      value: fmtCount(todayTasks.length),
      hint: todayTasks.length === 0 ? "Aucune tâche datée" : "à exécuter",
      href: "#collaborateurs",
    },
    {
      label: "Terminées",
      value: fmtCount(doneTodayTasks.length),
      hint: doneTodayTasks.length === 0 ? "Rien clôturé" : "aujourd'hui",
      href: "#termine",
    },
    {
      label: "À planifier",
      value: fmtCount(planningTasks.length),
      hint: planningTasks.length === 0 ? "Tout est cadré" : "sans date/responsable",
      href: "#planifier",
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
      <div className="p-8 min-h-screen space-y-6">
        <ModuleHeader
          icon={Sun}
          title="Aujourd'hui — Cockpit quotidien MyBotIA"
          subtitle="Chargement…"
        />
        <Skeleton.KPI count={4} />
        <Skeleton.Card className="h-48" />
        <Skeleton.Card className="h-32" />
      </div>
    );
  }

  return (
    <div className="p-8 min-h-screen space-y-6">
      <ModuleHeader
        icon={Sun}
        title="Aujourd'hui — Cockpit quotidien MyBotIA"
        subtitle="Exécution du jour, retards et clôtures par collaborateur"
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
          <a
            key={k.label}
            href={k.href}
            className="card-sharp-high p-5 hover:bg-surface-2/50 transition-colors block"
          >
            <span className="micro-label text-text-muted">{k.label}</span>
            <p className="text-2xl font-headline font-extrabold text-text-primary mt-2">{k.value}</p>
            <p className="text-[10px] text-text-muted mt-1">{k.hint}</p>
          </a>
        ))}
      </div>

      {/* === A. À reprendre === */}
      <section id="reprendre" className="card-sharp p-6">
        <SectionHeader icon={AlertTriangle} title="À reprendre en priorité" count={lateTasks.length} accent="text-status-danger" />
        {lateTasks.length === 0 ? (
          <EmptyHint text="Aucune tâche en retard." />
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

      {/* === B. Aujourd'hui par collaborateur === */}
      <section id="collaborateurs" className="card-sharp p-6">
        <SectionHeader icon={Users} title="Aujourd'hui par collaborateur" count={todayTasks.length} />
        {tasksByCollaborator.length === 0 ? (
          <EmptyHint text="Aucune tâche datée pour aujourd'hui." />
        ) : (
          <div className="space-y-4">
            {tasksByCollaborator.map((group) => (
              <TaskCollaboratorSection
                key={group.key}
                group={group}
                completing={completing}
                onMarkDone={markDone}
                onOpenTask={setSelectedTask}
              />
            ))}
          </div>
        )}
      </section>

      {/* === C. À planifier === */}
      <section id="planifier" className="card-sharp p-6">
        <SectionHeader icon={CalendarDays} title="À planifier" count={planningTasks.length} />
        {planningTasks.length === 0 ? (
          <EmptyHint text="Aucune tâche orpheline à requalifier." />
        ) : (
          <div className="divide-y divide-border-subtle">
            {planningTasks.map((t) => (
              <TaskRow
                key={`planning-${t.id}`}
                task={t}
                onMarkDone={() => markDone(t)}
                onOpen={() => setSelectedTask(t)}
                completing={completing === t.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* === D. Terminé aujourd'hui === */}
      <section id="termine" className="card-sharp p-6">
        <SectionHeader icon={ListChecks} title="Terminé aujourd'hui" count={doneTodayTasks.length} accent="text-emerald-300" />
        {doneTodayTasks.length === 0 ? (
          <EmptyHint text="Aucune tâche clôturée aujourd'hui pour l'instant." />
        ) : (
          <div className="divide-y divide-border-subtle">
            {doneTodayTasks.map((t) => (
              <TaskRow
                key={`done-${t.id}`}
                task={t}
                onMarkDone={() => undefined}
                onOpen={() => setSelectedTask(t)}
                completing={false}
                readonly
              />
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

      {/* Modal création tâche — tenant cockpit courant (V1.1.H P0-4) */}
      <CreateTaskModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => fetchToday()}
        tenantSlug={currentTenant}
        defaultDueDate={today}
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

function TaskCollaboratorSection({
  group,
  completing,
  onMarkDone,
  onOpenTask,
}: {
  group: TaskCollaboratorGroup;
  completing: string | null;
  onMarkDone: (task: TaskItem) => void;
  onOpenTask: (task: TaskItem) => void;
}) {
  return (
    <div className="border border-border-subtle bg-surface-2/30">
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-text-primary truncate">{group.label}</p>
          <p className="text-[10px] text-text-muted">
            {group.tasks.length} tâche{group.tasks.length > 1 ? "s" : ""} à traiter
          </p>
        </div>
        <span className="micro-label text-text-muted font-mono shrink-0">
          {group.tasks.length}
        </span>
      </div>
      <div className="divide-y divide-border-subtle px-3">
        {group.tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onMarkDone={() => onMarkDone(task)}
            onOpen={() => onOpenTask(task)}
            completing={completing === task.id}
          />
        ))}
      </div>
    </div>
  );
}

// Quick win 5 — wrapper minimaliste qui délègue à EmptyState (variant="inline")
// pour la cohérence visuelle avec les autres pages cockpit.
function EmptyHint({ text }: { text: string }) {
  return <EmptyState variant="inline" title={text} />;
}

function TaskRow({
  task,
  onMarkDone,
  onOpen,
  completing,
  lateInfo,
  readonly = false,
}: {
  task: TaskItem;
  onMarkDone: () => void;
  onOpen: () => void;
  completing: boolean;
  lateInfo?: string;
  readonly?: boolean;
}) {
  const prioColor =
    task.priority === "critical"
      ? "text-status-danger bg-status-danger/10 border-status-danger/30"
      : task.priority === "high"
      ? "text-amber-300 bg-amber-400/10 border-amber-400/30"
      : task.priority === "medium"
      ? "text-blue-300 bg-blue-500/10 border-blue-500/30"
      : "text-text-muted bg-surface-3/50 border-border-subtle";
  const workstream = taskWorkstream(task);

  return (
    <div className="py-2.5 flex items-center gap-3">
      {readonly ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
      ) : (
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
      )}
      <button
        type="button"
        onClick={onOpen}
        className="flex-1 min-w-0 text-left hover:bg-surface-2/50 -mx-2 px-2 py-1 transition-colors"
        title="Ouvrir le détail"
      >
        <p className="text-sm text-text-primary truncate">{task.title}</p>
        <div className="mt-1 flex min-w-0 items-center gap-1.5">
          <span
            className={cn(
              "inline-flex shrink-0 items-center border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tight",
              workstream.className,
            )}
          >
            {workstream.label}
          </span>
          <span className="truncate text-[10px] text-text-muted">
            {task.projectName || "(sans affaire)"}
            {task.dueDate && ` · ${formatDateFR(task.dueDate)}`}
          </span>
        </div>
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
