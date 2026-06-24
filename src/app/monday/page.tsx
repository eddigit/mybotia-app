"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, CheckSquare, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { btnPrimary, inputClass } from "@/components/shared/FormModal";
import { cn } from "@/lib/utils";

type MondayHealth = {
  configured: boolean;
  account?: { id: string; name: string; email?: string | null };
  error?: { code: string; message: string };
};

type MondayTask = {
  id: string;
  title: string;
  boardId: string;
  boardName: string;
  projectName: string;
  status: string;
  owner: string;
  priority: string;
  dueDate: string | null;
  source: "monday";
  url: string;
};

type MondayImportCandidate = {
  key: string;
  kind: "task" | "product";
  client: string;
  project: string;
  title: string;
  status: string;
  owner: string;
  priority: string;
  value: string | null;
  source: string;
};

type MondayImportPlan = {
  counts: {
    total: number;
    bySource: Record<string, number>;
    byClient: Record<string, number>;
  };
  warnings: string[];
  candidates: MondayImportCandidate[];
};

type MondayImportResponse = {
  dryRun: boolean;
  mondayConfigured?: boolean;
  plan?: MondayImportPlan;
  board?: { id: string; name: string; url?: string };
  imported?: { key: string; itemId: string; title: string }[];
  warnings?: string[];
  error?: { code: string; message: string };
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function taskBucket(task: MondayTask, today: string): "today" | "late" | "open" | "done" {
  if (/termin|done|livr/i.test(task.status)) return "done";
  if (task.dueDate === today) return "today";
  if (task.dueDate && task.dueDate < today) return "late";
  return "open";
}

export default function MondayPilotPage() {
  const [boardId, setBoardId] = useState("");
  const [health, setHealth] = useState<MondayHealth | null>(null);
  const [tasks, setTasks] = useState<MondayTask[]>([]);
  const [importPreview, setImportPreview] = useState<MondayImportPlan | null>(null);
  const [importResult, setImportResult] = useState<MondayImportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = todayISO();
  const grouped = useMemo(() => {
    const buckets = { today: [] as MondayTask[], late: [] as MondayTask[], open: [] as MondayTask[], done: [] as MondayTask[] };
    for (const task of tasks) buckets[taskBucket(task, today)].push(task);
    return buckets;
  }, [tasks, today]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const healthRes = await fetch("/api/monday/health", { cache: "no-store" });
      const healthJson = (await healthRes.json()) as MondayHealth;
      setHealth(healthJson);

      if (!boardId.trim()) {
        setTasks([]);
        return;
      }

      const tasksRes = await fetch(`/api/monday/tasks?boardId=${encodeURIComponent(boardId.trim())}`, { cache: "no-store" });
      const tasksJson = await tasksRes.json();
      if (!tasksRes.ok) throw new Error(tasksJson?.error?.message || `HTTP ${tasksRes.status}`);
      setTasks(tasksJson.tasks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function previewImport() {
    setImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/monday/import", { cache: "no-store" });
      const json = (await res.json()) as MondayImportResponse;
      if (!res.ok) throw new Error(json.error?.message || `HTTP ${res.status}`);
      setImportPreview(json.plan || null);
      setImportResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }

  async function applyImport() {
    if (!confirm("Creer le board Monday pilote et importer les taches, projets et produits/offres visibles dans l'aperçu ?")) return;
    setImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/monday/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmApply: true, limit: 120 }),
      });
      const json = (await res.json()) as MondayImportResponse;
      if (!res.ok) throw new Error(json.error?.message || `HTTP ${res.status}`);
      setImportResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }

  function renderTasks(title: string, rows: MondayTask[], tone: "today" | "late" | "open" | "done") {
    return (
      <section className="rounded-sm border border-border-subtle bg-surface-1 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <h2 className="text-sm font-bold text-text-primary">{title}</h2>
          <span className={cn("micro-label", tone === "late" ? "text-red-300" : "text-text-muted")}>{rows.length}</span>
        </div>
        <div className="divide-y divide-border-subtle">
          {rows.length === 0 ? (
            <p className="p-4 text-sm text-text-muted">Aucune tâche Monday dans cette vue.</p>
          ) : (
            rows.map((task) => (
              <a
                key={task.id}
                href={task.url}
                target="_blank"
                rel="noreferrer"
                className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr_0.8fr_0.7fr_0.7fr_auto] gap-2 px-4 py-3 text-sm hover:bg-surface-3/40 transition-colors"
              >
                <span className="font-medium text-text-primary">{task.title}</span>
                <span className="text-text-muted">Projet: {task.projectName}</span>
                <span className="text-text-muted">Statut: {task.status}</span>
                <span className="text-text-muted">Responsable: {task.owner}</span>
                <span className="text-text-muted">{task.dueDate || "Sans date"}</span>
                <ExternalLink className="w-4 h-4 text-text-muted" />
              </a>
            ))
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="p-8 min-h-screen space-y-6">
      <ModuleHeader
        icon={CalendarDays}
        title="Monday test — pilote production"
        subtitle="Lecture seule pour comparer Monday avec les tâches MyBotIA et Trello"
        actions={
          <button onClick={refresh} className={btnPrimary} disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Tester Monday
          </button>
        }
      />

      <section className="rounded-sm border border-border-subtle bg-surface-1 p-4 space-y-3">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-end">
          <label className="space-y-2">
            <span className="micro-label text-text-muted">Board ID Monday</span>
            <input
              value={boardId}
              onChange={(event) => setBoardId(event.target.value)}
              placeholder="Coller l'identifiant du board pilote Monday"
              className={inputClass}
            />
          </label>
          <div className="text-xs text-text-muted">
            Source pilote, aucune écriture Monday depuis cette page.
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-sm bg-surface-3 px-2 py-1 text-text-muted">Aujourd&apos;hui: {grouped.today.length}</span>
          <span className="rounded-sm bg-red-500/10 px-2 py-1 text-red-300">En retard: {grouped.late.length}</span>
          <span className="rounded-sm bg-surface-3 px-2 py-1 text-text-muted">Ouvertes: {grouped.open.length}</span>
          <span className="rounded-sm bg-surface-3 px-2 py-1 text-text-muted">Terminees: {grouped.done.length}</span>
        </div>
      </section>

      <section className="rounded-sm border border-border-subtle bg-surface-1 p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-text-primary">Import MyBotIA vers Monday</h2>
            <p className="text-xs text-text-muted mt-1">
              Mémoires Lea, catalogue offres, MyBotIA Business/Trello et CRM sont lus en aperçu avant écriture.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={previewImport} className={btnPrimary} disabled={importing}>
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Aperçu import
            </button>
            <button
              onClick={applyImport}
              className={cn(btnPrimary, "bg-emerald-600 hover:bg-emerald-500")}
              disabled={importing || !importPreview || !health?.configured}
            >
              Importer dans Monday
            </button>
          </div>
        </div>

        {importPreview && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-sm bg-surface-3 px-2 py-1 text-text-muted">Total: {importPreview.counts.total}</span>
              {Object.entries(importPreview.counts.bySource).map(([source, count]) => (
                <span key={source} className="rounded-sm bg-surface-3 px-2 py-1 text-text-muted">
                  {source}: {count}
                </span>
              ))}
            </div>
            {importPreview.warnings.length > 0 && (
              <div className="rounded-sm border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-100">
                {importPreview.warnings.slice(0, 4).map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            )}
            <div className="max-h-[320px] overflow-auto border border-border-subtle">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface-2 text-text-muted">
                  <tr>
                    <th className="text-left p-2">Type</th>
                    <th className="text-left p-2">Client</th>
                    <th className="text-left p-2">Projet</th>
                    <th className="text-left p-2">Objet</th>
                    <th className="text-left p-2">Valeur</th>
                    <th className="text-left p-2">Statut</th>
                    <th className="text-left p-2">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.candidates.slice(0, 80).map((candidate) => (
                    <tr key={candidate.key} className="border-t border-border-subtle">
                      <td className="p-2 text-text-muted">{candidate.kind === "product" ? "Produit/offre" : "Tache"}</td>
                      <td className="p-2 text-text-primary">{candidate.client}</td>
                      <td className="p-2 text-text-muted">{candidate.project}</td>
                      <td className="p-2 text-text-primary">{candidate.title}</td>
                      <td className="p-2 text-text-muted">{candidate.value || "-"}</td>
                      <td className="p-2 text-text-muted">{candidate.status}</td>
                      <td className="p-2 text-text-muted">{candidate.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {importResult?.board && (
          <div className="rounded-sm border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
            Board créé: {importResult.board.name} · {importResult.imported?.length || 0} éléments importés.
          </div>
        )}
      </section>

      {health && (
        <section className="rounded-sm border border-border-subtle bg-surface-1 p-4">
          <div className="flex items-center gap-2 text-sm">
            {health.configured ? <CheckSquare className="w-4 h-4 text-emerald-300" /> : <AlertTriangle className="w-4 h-4 text-yellow-300" />}
            <span className="font-medium text-text-primary">
              {health.configured ? `Connecté: ${health.account?.name || "Monday"}` : "Monday non configuré côté serveur"}
            </span>
          </div>
          {health.error && <p className="mt-2 text-xs text-text-muted">{health.error.message}</p>}
        </section>
      )}

      {error && (
        <section className="rounded-sm border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </section>
      )}

      <div className="grid grid-cols-1 gap-4">
        {renderTasks("Aujourd'hui", grouped.today, "today")}
        {renderTasks("En retard", grouped.late, "late")}
        {renderTasks("Ouvertes par projet", grouped.open, "open")}
        {renderTasks("Terminees", grouped.done, "done")}
      </div>
    </div>
  );
}
