"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessagesSquare,
  Users,
  CheckSquare,
  BarChart3,
  Bot,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { id: "home", label: "Command Center", href: "/", icon: LayoutDashboard },
  { id: "conversations", label: "Conversations", href: "/conversations", icon: MessagesSquare, badge: 5 },
  { id: "crm", label: "CRM / Activite", href: "/crm", icon: BarChart3 },
  { id: "tasks", label: "Taches", href: "/tasks", icon: CheckSquare, badge: 3 },
  { id: "agents", label: "Agents", href: "/agents", icon: Bot },
  { id: "documents", label: "Documents", href: "/documents", icon: FileText },
];

const bottomItems = [
  { id: "settings", label: "Parametres", href: "/settings", icon: Settings },
];

export function LeftSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-surface-0 font-headline tracking-wide antialiased relative z-20 transition-all duration-300 ease-in-out",
        collapsed ? "w-[68px]" : "w-[250px]"
      )}
    >
      {/* Logo */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-9 h-9 flex items-center justify-center bg-accent-primary rounded-lg shrink-0">
          <Shield className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div>
            <div className="text-lg font-extrabold tracking-tighter text-accent-glow">MyBotIA</div>
            <div className="micro-label text-text-muted">Premium</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 mt-2 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-center gap-3 py-3 text-sm transition-colors duration-200 relative",
                collapsed ? "justify-center px-2" : "pl-4",
                isActive
                  ? "text-accent-glow font-bold border-l-2 border-accent-primary bg-accent-primary/5"
                  : "text-text-muted hover:text-text-secondary hover:bg-surface-3/50 border-l-2 border-transparent"
              )}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && (
                <>
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto mr-2 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-sm text-[10px] font-bold bg-accent-primary/15 text-accent-glow">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
              {collapsed && item.badge && (
                <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-accent-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom nav */}
      <div className="px-3 py-3 border-t border-white/[0.04]">
        {bottomItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-center gap-3 py-3 text-sm transition-colors duration-200",
                collapsed ? "justify-center px-2" : "pl-4",
                isActive
                  ? "text-accent-glow font-bold"
                  : "text-text-muted hover:text-text-secondary"
              )}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </div>

      {/* User profile */}
      {!collapsed && (
        <div className="p-4 border-t border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-surface-3 ring-1 ring-accent-primary/20 flex items-center justify-center overflow-hidden">
              <span className="text-sm font-bold text-accent-glow">GK</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-text-primary truncate">Gilles Korzec</span>
              <span className="micro-label text-text-muted">Dirigeant</span>
            </div>
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 z-30 flex items-center justify-center w-6 h-6 rounded-full bg-surface-3 border border-white/[0.08] text-text-muted hover:text-text-primary hover:border-accent-primary/30 transition-all"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </aside>
  );
}
