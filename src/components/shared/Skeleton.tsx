"use client";

/**
 * Quick win 4 — Skeletons partagés.
 *
 * Remplace les loading spinners brutaux (`<Loader2 className="animate-spin" />`)
 * sur les pages critiques (/affaires, /productions, /finance, /admin/tenants).
 *
 * Variants exposés :
 *   - <Skeleton />          : bloc générique, accepte className
 *   - <Skeleton.Card />     : carte type KPI/section (5 lignes pulse)
 *   - <Skeleton.Table />    : table avec rows configurables
 *   - <Skeleton.KPI />      : grille de 3-4 KPI cards
 *   - <Skeleton.Sidebar />  : 5 entrées sidebar
 *
 * Tailwind pur, aucune dépendance ajoutée. Utilise `animate-pulse` natif
 * Tailwind + tokens `surface-2/3` du design system MyBotIA.
 */

import { cn } from "@/lib/utils";

function SkeletonBase({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse bg-surface-3/40 rounded-sm",
        className,
      )}
      aria-hidden="true"
    />
  );
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("card-sharp-high p-5 space-y-3", className)} aria-busy="true">
      <SkeletonBase className="h-3 w-1/3" />
      <SkeletonBase className="h-8 w-2/3" />
      <SkeletonBase className="h-2 w-1/2" />
    </div>
  );
}

function SkeletonKPI({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 md:grid-cols-4 gap-4",
        className,
      )}
      aria-busy="true"
      aria-label="Chargement des indicateurs"
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

function SkeletonTable({
  rows = 6,
  cols = 5,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("card-sharp p-0 overflow-hidden", className)}
      aria-busy="true"
      aria-label="Chargement du tableau"
    >
      {/* Header */}
      <div className="grid gap-4 px-4 py-3 border-b border-border-subtle"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonBase key={`h-${i}`} className="h-3" />
        ))}
      </div>
      {/* Rows */}
      <div className="divide-y divide-border-subtle">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={`r-${r}`}
            className="grid gap-4 px-4 py-3.5"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: cols }).map((_, c) => (
              <SkeletonBase
                key={`c-${r}-${c}`}
                className={cn(
                  "h-3",
                  c === 0 && "w-3/4",
                  c === cols - 1 && "w-1/2 ml-auto",
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonSidebar({
  count = 5,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)} aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
          <SkeletonBase className="w-4 h-4 rounded" />
          <SkeletonBase className="h-3 flex-1 max-w-[140px]" />
        </div>
      ))}
    </div>
  );
}

/**
 * Bloc page : KPI strip + table. Pratique pour /affaires, /productions,
 * /admin/tenants — un seul appel `<Skeleton.Page />` couvre 90% des cas.
 */
function SkeletonPage({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)} aria-busy="true">
      <div className="space-y-3">
        <SkeletonBase className="h-6 w-1/4" />
        <SkeletonBase className="h-3 w-1/3" />
      </div>
      <SkeletonKPI count={4} />
      <SkeletonTable rows={6} cols={5} />
    </div>
  );
}

export const Skeleton = Object.assign(SkeletonBase, {
  Card: SkeletonCard,
  KPI: SkeletonKPI,
  Table: SkeletonTable,
  Sidebar: SkeletonSidebar,
  Page: SkeletonPage,
});

export default Skeleton;
