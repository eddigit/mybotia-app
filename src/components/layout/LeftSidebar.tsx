"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessagesSquare,
  CheckSquare,
  BarChart3,
  Bot,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";

const LOGO_URL = "https://res.cloudinary.com/dniurvpzd/image/upload/q_auto/f_auto/v1772032713/Logo_Collaborateur_IA_coujhr.svg";

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
  const { user, logout } = useAuth();

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "??";

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-surface-0 tracking-wide antialiased relative z-20 transition-all duration-300 ease-in-out",
        collapsed ? "w-[68px]" : "w-[250px]"
      )}
    >
      {/* Logo */}
      <div className="p-5 flex items-center gap-3">
        <div className="w-10 h-10 flex items-center justify-center shrink-0">
          <Image
            src={LOGO_URL}
            alt="MyBotIA"
            width={40}
            height={40}
            className="w-10 h-10 object-contain"
            unoptimized
          />
        </div>
        {!collapsed && (
          <div>
            <div className="text-[17px] mybotia-wordmark text-accent-glow">MyBotIA</div>
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
      <div className="px-3 py-3 border-t border-border-subtle">
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
        <div className="p-4 border-t border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-surface-3 ring-1 ring-accent-primary/20 flex items-center justify-center overflow-hidden">
              <span className="text-sm font-bold text-accent-glow">{initials}</span>
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-semibold text-text-primary truncate">{user?.email}</span>
              <span className="micro-label text-text-muted">{user?.tenant_slug} &middot; {user?.role}</span>
            </div>
            <button
              onClick={logout}
              className="text-text-muted hover:text-red-400 transition-colors p-1"
              title="Deconnexion"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 z-30 flex items-center justify-center w-6 h-6 rounded-full bg-surface-3 border border-border-default text-text-muted hover:text-text-primary hover:border-accent-primary/30 transition-all"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </aside>
  );
}
