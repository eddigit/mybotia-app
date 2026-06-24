"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Sun,
  MessagesSquare,
  CheckSquare,
  Calendar,
  Wallet,
  Bot,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Briefcase,
  Hammer,
  Users,
  Receipt,
  FileSignature,
  Stethoscope,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useCockpitFeatures } from "@/hooks/use-api";
import { UserAvatarV4 } from "@/components/conversations/UserAvatarV4";
import { getTenantBranding } from "@/lib/tenant/branding";
import { TenantSwitcher } from "./TenantSwitcher";

const LOGO_URL =
  "https://res.cloudinary.com/dniurvpzd/image/upload/q_auto/f_auto/v1772032713/Logo_Collaborateur_IA_coujhr.svg";

// ============================================================================
// V1.1.E — Refonte sidebar app.mybotia.com
// ----------------------------------------------------------------------------
// - Groupes métier : Pilotage / Commercial / Finance / Opérations / Agents IA
// - Filtrage par feature DB (cockpit courant) + verticals tenant-specifics
// - Doctrine `feedback_sidebar_cockpit_boundary` : items tenant-spécifiques
//   visibles UNIQUEMENT si cockpit.tenant === slug. JAMAIS `|| isSuperadmin`.
// - Mobile drawer géré par MobileNavDrawer + variant="mobile"
// - Badge tenant en haut (TenantSwitcher) + active state coloré (primaryColor
//   à 20% alpha + barre verticale gauche).
// ----------------------------------------------------------------------------

// hex (#RRGGBB) -> rgba(r,g,b,alpha) — pour tinting de l'active state.
function hexAlpha(hex: string, alpha: number): string {
  const m = hex.match(/^#?([a-fA-F0-9]{6})$/);
  if (!m) return `rgba(14,165,233,${alpha})`;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

// ============================================================================
// Modèle de navigation
// ============================================================================

type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  /** feature DB requise (`features[mod] === true`). Si absent : always visible. */
  requiresModule?: string;
  /** slug tenant requis (doctrine cockpit boundary). */
  requiresTenant?: string;
};

type NavGroup = {
  id: string;
  label: string | null;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: "pilotage",
    label: "Pilotage",
    items: [
      { id: "home", label: "Tableau de bord", href: "/", icon: LayoutDashboard },
      { id: "today", label: "Aujourd'hui", href: "/today", icon: Sun },
      { id: "conversations", label: "Conversations", href: "/conversations", icon: MessagesSquare },
    ],
  },
  {
    id: "commercial",
    label: "Commercial",
    items: [
      { id: "affaires", label: "Pipeline", href: "/affaires", icon: Briefcase, requiresModule: "pipeline" },
      { id: "productions", label: "Productions", href: "/productions", icon: Hammer, requiresModule: "productions" },
      { id: "crm", label: "Clients", href: "/crm", icon: Users, requiresModule: "crm" },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      { id: "finance", label: "Trésorerie", href: "/finance", icon: Wallet, requiresModule: "finance" },
      // V1.1.F — Factures : page dédiée /invoices (CRUD complet côté app).
      // Devis : page dédiée /quotes en parallèle (CRUD partiel côté app,
      // /finance#devis reste accessible pour la vue agrégée).
      { id: "finance-devis", label: "Devis", href: "/quotes", icon: FileSignature, requiresModule: "finance" },
      { id: "finance-factures", label: "Factures", href: "/invoices", icon: Receipt, requiresModule: "finance" },
    ],
  },
  {
    id: "operations",
    label: "Opérations",
    items: [
      { id: "tasks", label: "Tâches", href: "/tasks", icon: CheckSquare, requiresModule: "tasks" },
      { id: "monday", label: "Monday test", href: "/monday", icon: Calendar },
      { id: "documents", label: "Documents", href: "/documents", icon: FileText, requiresModule: "documents" },
      { id: "agenda", label: "Calendrier", href: "/agenda", icon: Calendar, requiresModule: "agenda" },
    ],
  },
  {
    id: "agents",
    label: "Agents IA",
    items: [
      { id: "agents", label: "Mes agents", href: "/agents", icon: Bot },
    ],
  },
];

// Verticals tenant-specifics (doctrine cockpit boundary).
// Apparaissent UNIQUEMENT si le cockpit courant correspond au slug.
const VERTICAL_ITEMS: NavItem[] = [
  { id: "vlm", label: "VL Medical", href: "/vlm", icon: Stethoscope, requiresTenant: "vlmedical" },
  { id: "cmb", label: "CMB", href: "/cmb", icon: Briefcase, requiresTenant: "cmb" },
];

const BOTTOM_USER_ITEMS: NavItem[] = [
  { id: "settings", label: "Préférences", href: "/settings", icon: Settings },
];

// V1.2.E.1 — Doctrine `feedback_sidebar_un_seul_param` (11/05).
// La sidebar n'expose QU'UN SEUL item bas : "Paramètres" → /settings.
// Tout le reste (Modules, Tenants, Billing, Usage tokens, Protocoles WA,
// Vault) est exposé via des onglets conditionnels dans /settings selon
// isSuperadmin / user.email. NE PAS ré-introduire d'items admin ici.

// ============================================================================
// Composant
// ============================================================================

export function LeftSidebar({
  collapsed,
  onToggle,
  /**
   * Variante d'affichage. `mobile` désactive la barre de toggle latérale et
   * force la sidebar en pleine largeur (utilisée dans MobileNavDrawer).
   */
  variant = "desktop",
  onNavigate,
}: {
  collapsed: boolean;
  onToggle: () => void;
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { data: cockpitFeatures } = useCockpitFeatures();
  const features = cockpitFeatures?.features ?? {};
  const currentTenant = cockpitFeatures?.tenant;
  const isSuperadmin = cockpitFeatures?.isSuperadmin ?? false;
  const adminToolsEnabled = features.adminTools === true;

  const isMobile = variant === "mobile";
  // En drawer mobile : pas de collapse possible (pleine largeur).
  const effectiveCollapsed = isMobile ? false : collapsed;

  // Branding tenant (résolu via slug du cockpit, hostname-driven côté serveur).
  const branding = getTenantBranding(currentTenant);
  const activeBg = hexAlpha(branding.primaryColor, 0.2);
  const activeBorder = branding.primaryColor;

  // Doctrine `feedback_sidebar_cockpit_boundary` : items tenant-spécifiques
  // visibles UNIQUEMENT si cockpit.tenant === slug. JAMAIS `|| isSuperadmin`.
  // Pour qu'un superadmin voie l'entrée VLM, il bascule via le tenant switcher.
  const isTenantAllowed = (slug: string) => currentTenant === slug;

  // Module gating : pas de feature → always visible. Tant que le cockpit n'est
  // pas chargé, on laisse passer pour éviter un flash sidebar.
  const isModuleAllowed = (mod: string | undefined) => {
    if (!mod) return true;
    if (cockpitFeatures === null) return true;
    return features[mod] === true;
  };

  // Compose les groupes finaux + injecte verticals si cockpit le permet.
  const visibleGroups: NavGroup[] = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((it) => isModuleAllowed(it.requiresModule)),
  })).filter((g) => g.items.length > 0);

  const visibleVerticals = VERTICAL_ITEMS.filter(
    (it) => it.requiresTenant && isTenantAllowed(it.requiresTenant),
  );
  if (visibleVerticals.length > 0) {
    visibleGroups.push({
      id: "verticals",
      label: "Vertical métier",
      items: visibleVerticals,
    });
  }

  const userDisplayName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ") || undefined
    : undefined;

  // En drawer mobile : tout clic sur un Link interne doit fermer le drawer.
  const handleClick = isMobile && onNavigate
    ? (e: React.MouseEvent<HTMLElement>) => {
        const target = e.target as HTMLElement;
        if (target.closest("a[href]")) onNavigate();
      }
    : undefined;

  // ===== Render helpers =====

  const renderItem = (item: NavItem) => {
    const baseHref = item.href.split("#")[0];
    const isActive = baseHref === "/" ? pathname === "/" : pathname.startsWith(baseHref);
    const Icon = item.icon;
    return (
      <Link
        key={item.id}
        href={item.href}
        className={cn(
          "group flex items-center gap-3 py-2.5 text-sm rounded-md transition-colors duration-200 relative mx-1",
          effectiveCollapsed ? "justify-center px-2" : "pl-4 pr-3",
          isActive
            ? "font-semibold text-text-primary"
            : "text-text-muted hover:text-text-primary hover:bg-surface-2/60",
        )}
        style={
          isActive
            ? {
                backgroundColor: activeBg,
                boxShadow: `inset 3px 0 0 0 ${activeBorder}`,
              }
            : undefined
        }
        title={effectiveCollapsed ? item.label : undefined}
      >
        <Icon className="w-[18px] h-[18px] shrink-0" />
        {!effectiveCollapsed && <span className="truncate">{item.label}</span>}
      </Link>
    );
  };

  const renderGroup = (group: NavGroup) => (
    <div key={group.id} className="mb-3">
      {!effectiveCollapsed && group.label && (
        <div className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted/70">
          {group.label}
        </div>
      )}
      <div className="space-y-0.5">{group.items.map(renderItem)}</div>
    </div>
  );

  return (
    <aside
      onClick={handleClick}
      className={cn(
        "flex flex-col h-full bg-surface-0 tracking-wide antialiased relative z-20 transition-all duration-300 ease-in-out",
        isMobile
          ? "w-full"
          : effectiveCollapsed
            ? "w-[68px] border-r border-border-subtle"
            : "w-[260px] border-r border-border-subtle",
      )}
    >
      {/* Logo + branding tenant — fond légèrement teinté avec la couleur tenant
          (10% alpha) pour ancrer visuellement le cockpit courant. */}
      <div
        className="px-4 py-4 flex items-center gap-3 transition-colors duration-300"
        style={{
          backgroundColor: `color-mix(in srgb, ${branding.primaryColor} 10%, transparent)`,
          borderBottom: `1px solid color-mix(in srgb, ${branding.primaryColor} 18%, transparent)`,
        }}
      >
        <div className="w-9 h-9 flex items-center justify-center shrink-0">
          <Image
            src={branding.logoUrl ?? LOGO_URL}
            alt={branding.displayName}
            width={36}
            height={36}
            className="w-9 h-9 object-contain"
            unoptimized
          />
        </div>
        {!effectiveCollapsed && (
          <div className="min-w-0">
            <div className="text-[16px] mybotia-wordmark text-accent-glow leading-none truncate">
              {branding.displayName}
            </div>
            <div className="micro-label text-text-muted truncate">{branding.subLabel}</div>
          </div>
        )}
      </div>

      {/* Bloc 7F — Switcher de cockpit (superadmin = combobox, sinon read-only) */}
      <TenantSwitcher collapsed={effectiveCollapsed} />

      {/* Navigation groupée (Pilotage / Commercial / Finance / Opérations / Agents IA) */}
      <nav className="flex-1 px-2 pt-1 overflow-y-auto" aria-label="Navigation principale">
        {visibleGroups.map(renderGroup)}
      </nav>

      {/* Paramètres + admin tools (superadmin + features.adminTools) */}
      <div className="px-2 pt-1 border-t border-border-subtle">
        {!effectiveCollapsed && (
          <div className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted/70">
            Paramètres
          </div>
        )}
        <div className="space-y-0.5 pb-2">
          {BOTTOM_USER_ITEMS.map(renderItem)}
        </div>
      </div>

      {/* User profile + logout */}
      <div className="px-3 py-3 border-t border-border-subtle">
        <div
          className={cn(
            "flex items-center gap-3",
            effectiveCollapsed && "justify-center",
          )}
        >
          <UserAvatarV4
            email={user?.email}
            name={userDisplayName}
            avatarUrl={user?.avatar_url ?? null}
            size={effectiveCollapsed ? 30 : 34}
            className="ring-1 ring-accent-primary/20 shrink-0"
          />
          {!effectiveCollapsed && (
            <>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-semibold text-text-primary truncate">
                  {userDisplayName ?? user?.email}
                </span>
                <span className="micro-label text-text-muted truncate">
                  {user?.tenant_slug} · {user?.role}
                </span>
              </div>
              <button
                onClick={logout}
                className="text-text-muted hover:text-red-400 transition-colors p-1.5 rounded-md hover:bg-surface-2/60"
                title="Déconnexion"
                aria-label="Déconnexion"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Collapse toggle — desktop seul (sur mobile drawer, le X de fermeture
          du drawer remplit ce rôle). */}
      {!isMobile && (
        <button
          onClick={onToggle}
          className="absolute -right-3 top-20 z-30 flex items-center justify-center w-6 h-6 rounded-full bg-surface-3 border border-border-default text-text-muted hover:text-text-primary hover:border-accent-primary/30 transition-all"
          aria-label={collapsed ? "Déplier la sidebar" : "Replier la sidebar"}
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      )}
    </aside>
  );
}
