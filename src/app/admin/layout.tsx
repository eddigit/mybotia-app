// Layout server-side commun à toutes les pages /admin/*.
//
// Avant V1.2.E.2 : seul l'API /api/admin/* était gated côté serveur (403).
// Les pages /admin/* en "use client" affichaient leur squelette HTML aux
// users non-superadmins (audit QA 11/05, finding #2). UX dégradée + leak
// de la structure.
//
// Désormais : ce layout fait `requireSuperadmin()` côté serveur et redirige
// vers /login (avec ?next=) si pas autorisé. Tous les enfants en bénéficient
// y compris /admin/usage/tokens (nested) et /admin/vault (qui fait en plus
// son propre check `requireVaultOwner` plus strict).

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { requireSuperadmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const guard = await requireSuperadmin();
  if (!guard.ok) {
    const headerList = await headers();
    // x-pathname est posé par le proxy/middleware si présent ; sinon on
    // récupère depuis x-invoke-path (next.js) ou on fallback à /admin.
    const path =
      headerList.get("x-pathname") ??
      headerList.get("x-invoke-path") ??
      "/admin";
    const nextParam = encodeURIComponent(path);
    if (guard.status === 401) redirect(`/login?next=${nextParam}`);
    // 403 → on sort vers l'accueil (mieux qu'un 403 brut sans navigation)
    redirect("/");
  }
  return <>{children}</>;
}
