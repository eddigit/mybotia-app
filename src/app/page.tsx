import { CommandCenterHero } from "@/components/home/CommandCenterHero";
import { MetricCard } from "@/components/shared/MetricCard";
import { ActivityFeed } from "@/components/home/ActivityFeed";
import { QuickActions } from "@/components/home/QuickActions";
import { InsightCard } from "@/components/home/InsightCard";
import { AgentStatusGrid } from "@/components/home/AgentStatusGrid";
import { ProjectProgress } from "@/components/home/ProjectProgress";
import { metrics, activities, insights, agents, projects, tasks } from "@/data/mock";
import { ArrowRight } from "lucide-react";

export default function HomePage() {
  const criticalTasks = tasks.filter(t => t.priority === 'critical' && t.status !== 'done');

  return (
    <div className="p-8 min-h-screen">
      {/* Hero omnibar */}
      <CommandCenterHero />

      {/* Bento grid — Sovereign style */}
      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="section-header text-sm font-bold tracking-tight uppercase text-text-primary font-headline">
            Analyse proactive
          </h2>
          <button className="micro-label text-accent-glow hover:underline">Rafraichir</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {/* Large highlight card — span 2x2 */}
          <div className="md:col-span-2 md:row-span-2 card-sharp p-8 relative overflow-hidden group">
            {/* Background watermark icon */}
            <div className="absolute top-0 right-0 p-8 text-accent-primary opacity-[0.06] group-hover:opacity-[0.1] transition-opacity pointer-events-none">
              <svg width="180" height="180" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
              </svg>
            </div>

            <div className="relative z-10 flex flex-col h-full">
              <div className="inline-flex px-3 py-1 bg-accent-primary text-[10px] font-extrabold text-white uppercase tracking-tight w-fit mb-5">
                Insight critique
              </div>
              <h3 className="text-2xl lg:text-3xl font-headline font-extrabold mb-4 leading-tight text-text-primary">
                {criticalTasks.length} tache{criticalTasks.length > 1 ? 's' : ''} critique{criticalTasks.length > 1 ? 's' : ''} en cours
              </h3>
              <p className="text-text-secondary mb-6 max-w-md leading-relaxed">
                {criticalTasks[0]?.title}. L&apos;equipe IA est mobilisee. Demo Systemic prevue demain — preparation en cours.
              </p>
              <div className="mt-auto space-y-4">
                <div className="w-full h-1 bg-surface-3">
                  <div className="bg-accent-primary h-full" style={{ width: '35%' }} />
                </div>
                <div className="flex justify-between micro-label">
                  <span className="text-text-muted">Avancement global</span>
                  <span className="text-accent-glow">35% complete</span>
                </div>
                <button className="bg-accent-primary hover:bg-accent-primary/80 transition-colors text-white px-5 py-3 font-bold text-xs uppercase tracking-widest flex items-center gap-2 w-fit">
                  Voir les priorites
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Metric cards */}
          {metrics.slice(0, 2).map((m) => (
            <MetricCard key={m.id} metric={m} />
          ))}

          {/* Insight cards — border-left accent */}
          {insights.slice(0, 2).map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      </section>

      {/* Two-column: Feed + Side stack */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Intelligence Feed */}
        <div className="lg:col-span-2">
          <ActivityFeed activities={activities} />
        </div>

        {/* Right: Agents + Projects + Quick actions */}
        <div className="space-y-5">
          <AgentStatusGrid agents={agents} />
          <ProjectProgress projects={projects} />
          <QuickActions />
        </div>
      </section>
    </div>
  );
}
