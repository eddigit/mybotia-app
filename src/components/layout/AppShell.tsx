"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { LeftSidebar } from "./LeftSidebar";
import { TopBar } from "./TopBar";
import { ContextRail } from "./ContextRail";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

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
      </div>

      {/* Context Rail (right) */}
      {railOpen && <ContextRail onClose={() => setRailOpen(false)} />}
    </div>
  );
}
