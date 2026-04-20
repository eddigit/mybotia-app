"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useAgents, useTasks } from "@/hooks/use-api";
import { LeftSidebar } from "./LeftSidebar";
import { TopBar } from "./TopBar";
import { ContextRail } from "./ContextRail";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { data: agents } = useAgents();
  const { data: tasks } = useTasks();

  // Login page: render children directly (no shell)
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // Auth loading: show spinner
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface-0">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted micro-label">Chargement...</p>
        </div>
      </div>
    );
  }

  // Not authenticated: redirect to login
  if (!user) {
    router.push("/login");
    return null;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-0">
      {/* Left Sidebar */}
      <LeftSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0">
        <TopBar
          railOpen={railOpen}
          onToggleRail={() => setRailOpen(!railOpen)}
        />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        <footer className="shrink-0 border-t border-border-subtle bg-surface-0 py-1 text-center">
          <span className="text-[10px] text-text-muted tracking-wide">
            v1.0 · 20 avril 2026 · Conçu et réalisé par{" "}
            <a
              href="https://coachdigitalparis.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#6366f1] hover:underline"
            >
              Gilles Korzec
            </a>
          </span>
        </footer>
      </div>

      {/* Context Rail (right) */}
      {railOpen && <ContextRail onClose={() => setRailOpen(false)} agents={agents} tasks={tasks} />}
    </div>
  );
}
