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
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { id: "home", label: "Home", href: "/", icon: LayoutDashboard },
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
        "flex flex-col h-full border-r border-border-subtle bg-surface-1 transition-all duration-300 ease-in-out relative z-20",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-border-subtle">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent-primary/10 shrink-0">
          <Zap className="w-5 h-5 text-accent-primary" />
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-text-primary tracking-tight">MyBotIA</span>
            <span className="text-[10px] text-text-muted uppercase tracking-widest">Premium</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group relative",
                isActive
                  ? "bg-accent-primary/10 text-accent-glow"
                  : "text-text-secondary hover:text-text-primary hover:bg-white/[0.03]"
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-accent-primary" />
              )}
              <Icon className={cn("w-[18px] h-[18px] shrink-0", isActive && "text-accent-glow")} />
              {!collapsed && (
                <>
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-medium bg-accent-primary/20 text-accent-glow">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
              {collapsed && item.badge && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom nav */}
      <div className="py-2 px-2 border-t border-border-subtle">
        {bottomItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                isActive
                  ? "bg-accent-primary/10 text-accent-glow"
                  : "text-text-secondary hover:text-text-primary hover:bg-white/[0.03]"
              )}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 z-30 flex items-center justify-center w-6 h-6 rounded-full bg-surface-3 border border-border-default text-text-muted hover:text-text-primary hover:border-border-accent transition-all"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </aside>
  );
}
