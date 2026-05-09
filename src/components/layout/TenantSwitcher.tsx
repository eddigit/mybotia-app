"use client";

// Bloc 7F — Switcher de cockpit en haut de la sidebar.
//
// UX :
//   - Affiche en grand : badge coloré (initiale ou pastille primary_color),
//     displayName du tenant courant, sublabel (profile / role / "Superadmin").
//   - Si superadmin ET liste >= 2 tenants : dropdown avec les autres tenants.
//   - Sinon : juste l'affichage en lecture seule (pas de chevron, pas de click).
//   - Si la liste est indisponible (DB down → 503) : bouton désactivé avec
//     tooltip explicite. Aucun mock.
//   - Mode collapsed : pastille seule, dropdown s'ouvre au click et déborde
//     à droite de la sidebar.
//
// Fond : couleur tenant à 12% alpha (subtile) sur le bloc switcher.
//
// Doctrine respectée :
//   - feedback_sidebar_cockpit_boundary : pas de bypass superadmin sur les
//     entrées sidebar tenant-spécifiques. Le switcher CHANGE le cockpit
//     courant via cookie, mais ne contourne pas les filtres par cockpit.
//   - feedback_no_delete_igh_lucy : autorité = tenantSlug. Le cookie est
//     validé serveur, le slug whitelisté.

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Building2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTenantBranding } from "@/lib/tenant/branding";
import { TENANT_SWITCHED_EVENT } from "@/hooks/use-api";

interface TenantEntry {
  slug: string;
  displayName: string;
  profile: string;
  status: string;
  primaryColor: string | null;
  role: string | null;
  isCurrent: boolean;
}

interface TenantsPayload {
  tenants: TenantEntry[];
  current: string;
  isSuperadmin: boolean;
  canSwitch: boolean;
}

const DEFAULT_PRIMARY = "#6B46F5";

/** Couleur primaire effective : DB en priorité, sinon fallback `getTenantBranding`. */
function effectivePrimary(t: TenantEntry): string {
  return t.primaryColor || getTenantBranding(t.slug).primaryColor || DEFAULT_PRIMARY;
}

/** Display name effectif : `getTenantBranding` si plus court / charte. */
function effectiveDisplayName(t: TenantEntry): string {
  const branded = getTenantBranding(t.slug).displayName;
  // Si le mapping branding existe explicitement (slug connu) → on l'utilise.
  // Sinon on retombe sur le display_name DB.
  if (branded && branded !== t.slug) return branded;
  return t.displayName;
}

function hexToRgba(hex: string | null | undefined, alpha: number): string {
  const h = (hex || DEFAULT_PRIMARY).replace("#", "");
  if (h.length !== 6) return `rgba(107, 70, 245, ${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return `rgba(107, 70, 245, ${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function tenantInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

function profileLabel(profile: string): string {
  switch (profile) {
    case "classic": return "Cockpit standard";
    case "custom":  return "Cockpit dédié";
    default:        return profile || "Cockpit";
  }
}

interface TenantSwitcherProps {
  collapsed: boolean;
}

interface ToastState {
  message: string;
  tone: "success" | "error";
}

export function TenantSwitcher({ collapsed }: TenantSwitcherProps) {
  const router = useRouter();
  const [data, setData] = useState<TenantsPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // --- Fetch tenants ---
  useEffect(() => {
    let cancelled = false;
    fetch("/api/me/tenants", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          // 401/403/503 : on n'affiche pas le switcher.
          const msg = res.status === 503
            ? "Liste tenants indisponible"
            : `HTTP ${res.status}`;
          throw new Error(msg);
        }
        return res.json() as Promise<TenantsPayload>;
      })
      .then((json) => { if (!cancelled) setData(json); })
      .catch((e) => { if (!cancelled) setLoadError(e instanceof Error ? e.message : "Erreur"); });
    return () => { cancelled = true; };
  }, []);

  // --- Click outside to close ---
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // --- Toast auto-dismiss ---
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const switchTo = useCallback(async (slug: string) => {
    if (!data || switching) return;
    if (slug === data.current) {
      setOpen(false);
      return;
    }
    setSwitching(slug);
    const previousSlug = data.current;
    try {
      const res = await fetch("/api/me/switch-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ slug }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`);
      }
      const target = data.tenants.find((t) => t.slug === slug);
      const name = target ? effectiveDisplayName(target) : slug;

      // Optimistic update local : on marque le nouveau slug comme courant
      // immédiatement pour que le badge switcher (et le re-render) se mettent
      // à jour sans attendre le re-fetch /api/me/tenants.
      setData((prev) =>
        prev
          ? {
              ...prev,
              current: slug,
              tenants: prev.tenants.map((t) => ({
                ...t,
                isCurrent: t.slug === slug,
              })),
            }
          : prev
      );

      setToast({ message: `Cockpit basculé sur ${name}`, tone: "success" });
      setOpen(false);

      // Refresh Server Components + navigation home (le précédent cockpit
      // peut avoir des pages tenant-spécifiques inaccessibles dans le nouveau).
      router.replace("/");
      router.refresh();

      // V1.1.H.1 — invalidation cross-domain APRÈS router.replace()/refresh().
      //
      // Ordre corrigé (bug race condition V1.1.G) :
      //   Avant : dispatchEvent était appelé AVANT router.replace(). router.replace()
      //   cause un unmount des composants page → les useEffect cleanup des hooks
      //   useApi settaient cancelled=true, annulant le fetch déclenché par l'event.
      //   Le refetch tombait dans le vide et les composants remontaient avec leur
      //   ancien state, forçant un F5 pour récupérer le bon tenant.
      //
      //   Après : on délègue le dispatch à un setTimeout(0) pour laisser React
      //   flusher le cycle de navigation (router.replace → unmount → remount des
      //   nouveaux composants avec leurs listeners) AVANT d'émettre l'event.
      //   Les hooks useApi fraîchement montés reçoivent l'event et refetch avec
      //   le cookie cockpit_tenant déjà posé → résolution correcte immédiate.
      //
      // Le cookie `cockpit_tenant` est posé serveur-side avant ce point (dans la
      // réponse HTTP du POST /api/me/switch-tenant), donc aucune race sur le cookie.
      if (typeof window !== "undefined") {
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent(TENANT_SWITCHED_EVENT, {
              detail: { fromSlug: previousSlug, toSlug: slug },
            })
          );
        }, 0);
      }
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : "Bascule impossible",
        tone: "error",
      });
    } finally {
      setSwitching(null);
    }
  }, [data, switching, router]);

  // --- Loading state (avant fetch) — placeholder discret ---
  if (!data && !loadError) {
    return (
      <div
        className={cn(
          "mx-3 mt-1 mb-3 rounded-lg border border-border-subtle bg-surface-1/40 animate-pulse",
          collapsed ? "h-12" : "h-[58px]"
        )}
        aria-hidden="true"
      />
    );
  }

  // --- Error state — switcher désactivé avec tooltip ---
  if (loadError || !data) {
    return (
      <div
        className={cn(
          "mx-3 mt-1 mb-3 rounded-lg border border-border-subtle bg-surface-1/40 px-3 py-2 flex items-center gap-2 text-text-muted",
          collapsed && "justify-center px-2"
        )}
        title={`Switcher tenant indisponible : ${loadError ?? "réponse vide"}`}
      >
        <AlertCircle className="w-4 h-4 shrink-0 text-amber-400/70" />
        {!collapsed && (
          <span className="text-xs truncate">Tenants indisponibles</span>
        )}
      </div>
    );
  }

  const current = data.tenants.find((t) => t.slug === data.current) ?? data.tenants[0];
  if (!current) return null; // safety

  const others = data.tenants.filter((t) => t.slug !== current.slug);
  const interactive = data.canSwitch && others.length > 0;
  const currentColor = effectivePrimary(current);
  const currentName = effectiveDisplayName(current);
  const tintBg = hexToRgba(currentColor, 0.12);
  const tintBorder = hexToRgba(currentColor, 0.28);

  return (
    <div
      ref={containerRef}
      className={cn("relative mx-3 mt-1 mb-3", collapsed && "mx-2")}
    >
      <button
        type="button"
        onClick={() => interactive && setOpen((v) => !v)}
        disabled={!interactive}
        aria-expanded={open}
        aria-haspopup={interactive ? "listbox" : undefined}
        title={
          interactive
            ? "Basculer de cockpit"
            : data.isSuperadmin
              ? "Un seul tenant disponible"
              : `Cockpit ${currentName}`
        }
        className={cn(
          "w-full flex items-center gap-3 rounded-lg border transition-all duration-200",
          "px-3 py-2 text-left",
          collapsed && "justify-center px-2 py-2",
          interactive
            ? "hover:brightness-110 cursor-pointer"
            : "cursor-default",
          open && "ring-1 ring-accent-primary/30"
        )}
        style={{
          backgroundColor: tintBg,
          borderColor: tintBorder,
        }}
      >
        <span
          className="flex items-center justify-center shrink-0 rounded-md text-[11px] font-bold uppercase tracking-wider text-white shadow-sm"
          style={{
            backgroundColor: currentColor,
            width: collapsed ? 28 : 32,
            height: collapsed ? 28 : 32,
          }}
        >
          {tenantInitials(currentName)}
        </span>
        {!collapsed && (
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-semibold text-text-primary truncate leading-tight">
              {currentName}
            </span>
            <span className="micro-label text-text-muted truncate">
              {data.isSuperadmin
                ? `Superadmin · ${profileLabel(current.profile)}`
                : current.role
                  ? `${current.role} · ${profileLabel(current.profile)}`
                  : profileLabel(current.profile)}
            </span>
          </div>
        )}
        {!collapsed && interactive && (
          <ChevronsUpDown className="w-4 h-4 shrink-0 text-text-muted" />
        )}
      </button>

      {/* Dropdown */}
      {open && interactive && (
        <div
          role="listbox"
          className={cn(
            "absolute z-50 mt-1 rounded-lg border border-border-default bg-surface-1 shadow-xl shadow-black/30",
            collapsed
              ? "left-full ml-2 top-0 w-[260px]"
              : "left-0 right-0"
          )}
        >
          <div className="px-3 py-2 border-b border-border-subtle flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-text-muted" />
            <span className="micro-label text-text-muted uppercase">
              Cockpits disponibles
            </span>
          </div>
          <ul className="max-h-[60vh] overflow-y-auto py-1">
            {data.tenants.map((t) => {
              const isActive = t.slug === current.slug;
              const isLoading = switching === t.slug;
              const itemName = effectiveDisplayName(t);
              const itemColor = effectivePrimary(t);
              return (
                <li key={t.slug}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => switchTo(t.slug)}
                    disabled={!!switching}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                      "hover:bg-surface-2/60 focus:bg-surface-2/60 focus:outline-none",
                      isActive && "bg-accent-primary/8",
                      switching && !isLoading && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    <span
                      className="flex items-center justify-center shrink-0 rounded-md text-[10px] font-bold text-white"
                      style={{
                        backgroundColor: itemColor,
                        width: 26,
                        height: 26,
                      }}
                    >
                      {tenantInitials(itemName)}
                    </span>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="truncate text-text-primary font-medium">
                        {itemName}
                      </span>
                      <span className="micro-label text-text-muted truncate">
                        {t.slug} · {profileLabel(t.profile)}
                      </span>
                    </div>
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 shrink-0 text-text-muted animate-spin" />
                    ) : isActive ? (
                      <Check className="w-4 h-4 shrink-0 text-accent-glow" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Toast — bottom-right of viewport, hors flow sidebar */}
      {toast && (
        <div
          role="status"
          className={cn(
            "fixed bottom-6 right-6 z-[60] px-4 py-3 rounded-lg shadow-2xl text-sm font-medium",
            "border backdrop-blur-md",
            toast.tone === "success"
              ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-200"
              : "bg-red-500/15 border-red-400/30 text-red-200"
          )}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
