// Page Vault — server gate (requireVaultOwner) puis rendu client.
//
// Accès strict gilleskorzec@gmail.com. Tout autre user voit un 403 statique
// (et n'a pas dû arriver ici puisque l'onglet sidebar est caché).

import { redirect } from "next/navigation";

import { requireVaultOwner } from "@/lib/vault/guard";

import { VaultClient } from "./VaultClient";

export const dynamic = "force-dynamic";

export default async function VaultPage() {
  const guard = await requireVaultOwner();
  if (!guard.ok) {
    if (guard.status === 401) redirect("/login?next=%2Fadmin%2Fvault");
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-semibold mb-2">Accès refusé</h1>
        <p className="text-sm text-text-muted">
          Le vault est réservé à l&apos;owner du système.
        </p>
      </div>
    );
  }
  return <VaultClient />;
}
