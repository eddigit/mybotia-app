"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Sun,
  MessagesSquare,
  CheckSquare,
  BarChart3,
  TrendingUp,
  Calendar,
  Wallet,
  Bot,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useCockpitFeatures } from "@/hooks/use-api";
import { Shield, Coins, Stethoscope, MessageSquare } from "lucide-react";

const LOGO_URL = "https://res.cloudinary.com/dniurvpzd/image/upload/q_auto/f_auto/v1772032713/Logo_Collaborateur_IA_coujhr.svg";

// Bloc 5A — sidebar orientée usage entrepreneur quotidien.
// Bloc 6B — chaque entrée peut déclarer une `feature` qui doit être activée
// dans le tenant courant pour être visible (sauf si `alwaysVisible=true`).
const navItems: Array<{
  id: string;
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  badge?: number;
  feature?: string;        // si défini : feature DB requise
  alwaysVisible?: boolean; // toujours afficher (Command Center, Aujourd'hui, Conversations)
}> = [
  { id: "home",          label: "Command Center", href: "/",              icon: LayoutDashboard, alwaysVisible: true },
  { id: "today",         label: "Aujourd'hui",    href: "/today",         icon: Sun,             alwaysVisible: true },
  { id: "conversations", label: "Conversations",  href: "/conversations", icon: MessagesSquare,  alwaysVisible: true },
  { id: "crm",           label: "CRM / Clients",  href: "/crm",           icon: BarChart3,       feature: "crm" },
  { id: "pipeline",      label: "Pipeline",       href: "/pipeline",      icon: TrendingUp,      feature: "pipeline" },
  { id: "tasks",         label: "Tâches",         href: "/tasks",         icon: CheckSquare,     feature: "tasks" },
  { id: "agenda",        label: "Agenda",         href: "/agenda",        icon: Calendar,        feature: "agenda" },
  { id: "documents",     label: "Documents",      href: "/documents",     icon: FileText,        feature: "documents" },
  { id: "agents",        label: "Agents IA",      href: "/agents",        icon: Bot,             alwaysVisible: true },
  { id: "finance",       label: "Finances",       href: "/finance",       icon: Wallet,          feature: "finance" },
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
  // Bloc 6B — features du cockpit courant (résolu serveur via hostname).
  const { data: cockpitFeatures } = useCockpitFeatures();
  const features = cockpitFeatures?.features ?? {};
  const isSuperadmin = cockpitFeatures?.isSuperadmin ?? false;
  // Bloc 7E — entrée VL Medical visible UNIQUEMENT quand le cockpit courant
  // est vlmedical. Le superadmin sur app.mybotia.com ne voit pas l'entrée :
  // il accède au vertical via /admin/tenants/vlmedical ou via le hostname
  // vlmedical.mybotia.com. Doctrine : hostname → tenant → modules visibles.
  const showVlmEntry = cockpitFeatures?.tenant === "vlmedical";
  // Pendant le chargement, on laisse passer (cockpitFeatures=null) pour ne pas
  // faire scintiller la sidebar. Une fois chargé, on filtre.
  const filteredNav = navItems.filter((item) => {
    if (item.alwaysVisible) return true;
    if (!item.feature) return true;
    if (cockpitFeatures === null) return true; // loading state
    return features[item.feature] === true;
  });

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
        {filteredNav.map((item) => {
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

      {/* Bloc 7E — entrée VL Medical visible uniquement quand cockpit === vlmedical */}
      {showVlmEntry && (
        <div className="px-3 py-2 border-t border-border-subtle">
          <Link
            href="/vlm"
            className={cn(
              "flex items-center gap-3 py-2 text-sm transition-colors duration-200",
              collapsed ? "justify-center px-2" : "pl-4",
              pathname.startsWith("/vlm")
                ? "text-amber-300 font-bold border-l-2 border-amber-300/50 bg-amber-400/5"
                : "text-text-muted hover:text-amber-300 border-l-2 border-transparent"
            )}
            title="VL Medical — vertical import/export"
          >
            <Stethoscope className="w-[18px] h-[18px] shrink-0" />
            {!collapsed && <span className="truncate">VL Medical</span>}
          </Link>
        </div>
      )}

      {/* Bottom nav — admin tools (superadmin + features.adminTools) */}
      {isSuperadmin && features.adminTools === true && (
        <div className="px-3 py-2 border-t border-border-subtle space-y-0.5">
          <Link
            href="/admin/tenants"
            className={cn(
              "flex items-center gap-3 py-2 text-sm transition-colors duration-200",
              collapsed ? "justify-center px-2" : "pl-4",
              pathname === "/admin/tenants" || pathname.startsWith("/admin/tenants/")
                ? "text-amber-300 font-bold border-l-2 border-amber-300/50 bg-amber-400/5"
                : "text-text-muted hover:text-amber-300 border-l-2 border-transparent"
            )}
            title="Admin tenants (superadmin)"
          >
            <Shield className="w-[18px] h-[18px] shrink-0" />
            {!collapsed && <span className="truncate">Admin tenants</span>}
          </Link>
          <Link
            href="/admin/billing"
            className={cn(
              "flex items-center gap-3 py-2 text-sm transition-colors duration-200",
              collapsed ? "justify-center px-2" : "pl-4",
              pathname.startsWith("/admin/billing")
                ? "text-amber-300 font-bold border-l-2 border-amber-300/50 bg-amber-400/5"
                : "text-text-muted hover:text-amber-300 border-l-2 border-transparent"
            )}
            title="Billing IA — admin global"
          >
            <Wallet className="w-[18px] h-[18px] shrink-0" />
            {!collapsed && <span className="truncate">Billing IA</span>}
          </Link>
          <Link
            href="/admin/usage/tokens"
            className={cn(
              "flex items-center gap-3 py-2 text-sm transition-colors duration-200",
              collapsed ? "justify-center px-2" : "pl-4",
              pathname.startsWith("/admin/usage")
                ? "text-amber-300 font-bold border-l-2 border-amber-300/50 bg-amber-400/5"
                : "text-text-muted hover:text-amber-300 border-l-2 border-transparent"
            )}
            title="Usage tokens — détail technique"
          >
            <Coins className="w-[18px] h-[18px] shrink-0" />
            {!collapsed && <span className="truncate">Usage tokens</span>}
          </Link>
          <Link
            href="/admin/whatsapp-protocols"
            className={cn(
              "flex items-center gap-3 py-2 text-sm transition-colors duration-200",
              collapsed ? "justify-center px-2" : "pl-4",
              pathname.startsWith("/admin/whatsapp-protocols")
                ? "text-amber-300 font-bold border-l-2 border-amber-300/50 bg-amber-400/5"
                : "text-text-muted hover:text-amber-300 border-l-2 border-transparent"
            )}
            title="Protocoles WhatsApp — admin"
          >
            <MessageSquare className="w-[18px] h-[18px] shrink-0" />
            {!collapsed && <span className="truncate">Protocoles WhatsApp</span>}
          </Link>
        </div>
      )}

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
