"use client";

// Cockpit principal — VERROUILLÉ tenant=mybotia.
// Plus aucun pill tenant, plus aucune vue globale.
// La vue admin globale (multi-tenant) sera une zone séparée future
// (/admin/tenants ou /agents/<agent>), pas le cockpit principal.

import { useState } from "react";
import { CommandCenterHero } from "@/components/home/CommandCenterHero";
import { MetricCard } from "@/components/shared/MetricCard";
import { ActivityFeed } from "@/components/home/ActivityFeed";
import { QuickActions } from "@/components/home/QuickActions";
import { AgentStatusGrid } from "@/components/home/AgentStatusGrid";
import { ProjectProgress } from "@/components/home/ProjectProgress";
import { TodayTasksCard } from "@/components/home/TodayTasksCard";
import { CreateProjectModal } from "@/components/shared/CreateProjectModal";
import {
  useScopedDashboard,
  useAgents,
  useScopedTasks,
} from "@/hooks/use-api";
import { ArrowRight, FolderPlus } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  const { data: dashboard, loading } = useScopedDashboard();
  const { data: agents } = useAgents();
  const { data: tasks } = useScopedTasks();
  const [showCreateProject, setShowCreateProject] = useState(false);

  const clients = dashboard?.clients ?? [];
  const deals = dashboard?.deals ?? [];
  const projectsAll = dashboard?.projects ?? [];
  const activities = dashboard?.activities ?? [];

  const criticalTasks = tasks.filter(
    (t) => t.priority === "critical" && t.status !== "done"
  );

  const pipelineTotal = deals.reduce((sum, d) => sum + d.value, 0);
  const displayProjects = projectsAll
    .filter((p) => p.status === "active")
    .slice(0, 5);

  if (loading) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted micro-label">Chargement des donnees...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 min-h-screen">
      {/* Hero omnibar */}
      <CommandCenterHero />

      {/* Bento grid — Sovereign style */}
      <section className="mb-10 mt-6">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="section-header text-sm font-bold tracking-tight uppercase text-text-primary font-headline">
            Analyse proactive · MyBotIA
          </h2>
          <button
            onClick={() => window.location.reload()}
            className="micro-label text-accent-glow hover:underline"
          >
            Rafraichir
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {/* Large highlight card — span 2x2 */}
          <div className="md:col-span-2 md:row-span-2 card-sharp p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 text-accent-primary opacity-[0.06] group-hover:opacity-[0.1] transition-opacity pointer-events-none">
              <svg width="180" height="180" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
              </svg>
            </div>

            <div className="relative z-10 flex flex-col h-full">
              <div className="inline-flex px-3 py-1 bg-accent-primary text-[10px] font-extrabold text-white uppercase tracking-tight w-fit mb-5">
                Donnees en direct
              </div>
              <h3 className="text-2xl lg:text-3xl font-headline font-extrabold mb-4 leading-tight text-text-primary">
                {clients.length} clients · MyBotIA
              </h3>
              <p className="text-text-secondary mb-6 max-w-md leading-relaxed">
                {deals.length} opportunites en pipeline pour un total de{" "}
                {pipelineTotal.toLocaleString("fr-FR")} EUR.
                {criticalTasks.length > 0 &&
                  ` ${criticalTasks.length} tache(s) critique(s) en cours.`}
              </p>
              <div className="mt-auto space-y-4">
                <div className="w-full h-1 bg-surface-3">
                  <div
                    className="bg-accent-primary h-full"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          (projectsAll.filter((p) => p.status === "completed").length /
                            Math.max(1, projectsAll.length)) *
                            100
                        )
                      )}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between micro-label">
                  <span className="text-text-muted">
                    {projectsAll.filter((p) => p.status === "active").length} projets actifs
                  </span>
                  <span className="text-accent-glow">
                    {projectsAll.filter((p) => p.status === "completed").length} termines
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <Link
                    href="/tasks"
                    className="bg-accent-primary hover:bg-accent-primary/80 transition-colors text-white px-5 py-3 font-bold text-xs uppercase tracking-widest flex items-center gap-2 w-fit"
                  >
                    Voir les priorites
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                  <button
                    onClick={() => setShowCreateProject(true)}
                    className="bg-surface-3 hover:bg-surface-4 transition-colors text-text-primary px-5 py-3 font-bold text-xs uppercase tracking-widest flex items-center gap-2 w-fit"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    Nouveau projet
                  </button>
                </div>
              </div>
            </div>
          </div>

          <Link href="/crm" className="block group">
            <MetricCard
              metric={{
                id: "metric-clients",
                label: "Clients actifs",
                value: clients.filter((c) => c.status === "active").length.toString(),
                trend: "stable",
                changeLabel: "MyBotIA",
              }}
            />
          </Link>
          <Link href="/pipeline" className="block group">
            <MetricCard
              metric={{
                id: "metric-pipeline",
                label: "Pipeline",
                value: `${pipelineTotal.toLocaleString("fr-FR")} EUR`,
                trend: "up",
                changeLabel: `${deals.length} opportunites`,
              }}
            />
          </Link>
          <Link href="/tasks" className="block group">
            <MetricCard
              metric={{
                id: "metric-tasks-today",
                label: "Tâches actives",
                value: tasks.filter((t) => t.status !== "done").length.toString(),
                trend: criticalTasks.length > 0 ? "down" : "stable",
                changeLabel:
                  criticalTasks.length > 0 ? `${criticalTasks.length} critiques` : "à jour",
              }}
            />
          </Link>
          <Link href="/tasks" className="block group">
            <MetricCard
              metric={{
                id: "metric-tasks-late",
                label: "Retards",
                value: tasks
                  .filter((t) => t.overdue && t.status !== "done")
                  .length.toString(),
                trend: "down",
                changeLabel: "tâches en retard",
              }}
            />
          </Link>
        </div>
      </section>

      {/* Two-column: Feed + Side stack */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActivityFeed activities={activities} />
        </div>

        <div className="space-y-5">
          <TodayTasksCard />
          <AgentStatusGrid agents={agents} />
          <ProjectProgress projects={displayProjects} />
          <QuickActions />
        </div>
      </section>

      <CreateProjectModal
        open={showCreateProject}
        onClose={() => setShowCreateProject(false)}
        onCreated={() => window.location.reload()}
      />
    </div>
  );
}
