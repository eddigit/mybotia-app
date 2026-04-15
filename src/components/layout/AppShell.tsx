"use client";

import { useState } from "react";
import { LeftSidebar } from "./LeftSidebar";
import { TopBar } from "./TopBar";
import { ContextRail } from "./ContextRail";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [railOpen, setRailOpen] = useState(true);

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
