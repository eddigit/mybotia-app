// Bloc 5E — CRUD projet sécurisé MyBotIA.
//   - GET enrichi : projet + proposals + invoices liés + flag deleteAllowed
//   - PATCH multi-tenant safe + whitelist (Bloc 5B)
//     (whitelist 5E élargie : description, note_public, note_private)
//   - DELETE multi-tenant safe + GARDE-FOUS SERVEUR (Bloc 5E)
//     (refus si proposals/invoices liés ou si statut non supprimable)
//
// Sécurité tenant :
//   - User normal : tenant_slug DOIT matcher session.tenantSlug.
//   - Superadmin : tenant_slug DOIT être dans getSessionTenants().
//   - Aucun fallback silencieux.

import {
  getProject,
  updateProject,
  deleteProject,
  getProjectInvoices,
  getProjectProposals,
  getThirdParty,
} from "@/lib/dolibarr";
import { mapDolibarrProject } from "@/lib/mappers";
import { resolveCockpitTenants } from "@/lib/tenant-resolver";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

const ALLOWED_FIELDS = [
  "opp_status",
  "opp_amount",
  "opp_percent",
  "title",
  "status",
  "description",
  "note_public",
  "note_private",
] as const;

// Bloc 5E — règles métier suppression projet.
// Si la fonction renvoie une string, c'est le motif de blocage. Sinon null = autorisé.
//
// Bloc 5E-SAFE (post-incident LUCY-IGH 2026-05-03) : la suppression est désormais
// réservée aux projets explicitement marqués test (ref ou title TEST-/TMP-/TEST/TMP).
// Tout autre projet est PROTÉGÉ même sans devis/facture, pour éviter une perte
// accidentelle d'un projet client opérationnel non encore facturé (cas Lucy/IGH).
function isTestProject(project: { ref?: string; title?: string }): boolean {
  const ref = (project.ref || "").toUpperCase();
  const title = (project.title || "").toUpperCase();
  return (
    ref.startsWith("TEST-") ||
    ref.startsWith("TMP-") ||
    title.includes("TEST") ||
    title.includes("TMP")
  );
}

// Bloc 5E-SAFE corrigé : doctrine = tenantSlug est l'unique critère d'autorité.
// L'isolation tenant est garantie par le hostname resolver côté serveur :
// un cockpit mybotia ne peut accéder qu'aux projets du tenant mybotia. Donc
// pas besoin de filtrer par contenu textuel (CMB/IGH/Lucy/VL Medical peuvent
// légitimement apparaître dans MyBotIA si ce sont des affaires commerciales
// portées par le tenant mybotia : ex. projet "LUCY-IGH" = mission MyBotIA
// vendue au Groupe IGH, ou "Préparation Raphaël" = tâche MyBotIA de
// livraison du collaborateur IA au client CMB).
function evaluateDeleteGuards(
  project: Awaited<ReturnType<typeof getProject>>,
  proposals: Awaited<ReturnType<typeof getProjectProposals>>,
  invoices: Awaited<ReturnType<typeof getProjectInvoices>>
): string | null {
  if (proposals.length > 0) {
    return `${proposals.length} devis lié(s) — suppression interdite. Archive le projet ou supprime les devis d'abord.`;
  }
  if (invoices.length > 0) {
    return `${invoices.length} facture(s) liée(s) — suppression interdite (intégrité comptable).`;
  }
  if (project.opp_status === "6") {
    return "Affaire gagnée — suppression interdite. Utilise Archiver.";
  }
  if (!isTestProject(project)) {
    return "Projet non-test — suppression interdite par défaut. Utilise Archiver, ou renomme la ref/title en TEST-* / TMP-* si c'est vraiment un projet à supprimer.";
  }
  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    if (!id || !/^\d+$/.test(id)) {
      return Response.json({ error: "id projet invalide" }, { status: 400, headers: NO_STORE });
    }

    const cockpit = await resolveCockpitTenants(request);
    if (!cockpit.ok) {
      return Response.json({ error: cockpit.error }, { status: cockpit.status, headers: NO_STORE });
    }
    const tenantCfg = cockpit.tenant;

    const dp = await getProject(id, tenantCfg);
    const project = mapDolibarrProject(dp, 0, undefined, cockpit.slug);

    // Enrichissements 5E : proposals + invoices liés + clientName via tenant
    const [proposals, invoices, tp] = await Promise.all([
      getProjectProposals(id, tenantCfg).catch(() => []),
      getProjectInvoices(id, tenantCfg).catch(() => []),
      dp.socid ? getThirdParty(dp.socid, tenantCfg).catch(() => null) : Promise.resolve(null),
    ]);

    const clientName = tp ? tp.name_alias || tp.name : project.clientName;
    const deleteBlockedReason = evaluateDeleteGuards(dp, proposals, invoices);

    return Response.json(
      {
        project: { ...project, clientName },
        description: dp.description || "",
        note_public: dp.note_public || "",
        note_private: dp.note_private || "",
        opp_status: dp.opp_status || null,
        proposals: proposals.map((p) => ({
          id: p.id,
          ref: p.ref,
          total: parseFloat(p.total_ttc || "0"),
          status: p.statut,
          date: p.date,
        })),
        invoices: invoices.map((inv) => ({
          id: inv.id,
          ref: inv.ref,
          total: parseFloat(inv.total_ttc || "0"),
          status: inv.status,
          paye: inv.paye,
          date: inv.date,
        })),
        deleteAllowed: deleteBlockedReason === null,
        deleteBlockedReason,
        // Bloc 5E-SAFE : flag exposé pour que l'UI masque entièrement le bouton
        // Supprimer sur les projets non-test (vs juste désactivé).
        isTestProject: isTestProject(dp),
        tenantSlug: cockpit.slug,
      },
      { headers: NO_STORE }
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur Dolibarr" },
      { status: 502, headers: NO_STORE }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || !/^\d+$/.test(id)) {
      return Response.json({ error: "id projet invalide" }, { status: 400, headers: NO_STORE });
    }

    const cockpit = await resolveCockpitTenants(request);
    if (!cockpit.ok) {
      return Response.json({ error: cockpit.error }, { status: cockpit.status, headers: NO_STORE });
    }

    const rawBody = await request.json().catch(() => null);

    if (!rawBody || typeof rawBody !== "object") {
      return Response.json({ error: "body json invalide" }, { status: 400, headers: NO_STORE });
    }

    const payload: Record<string, unknown> = {};
    for (const k of ALLOWED_FIELDS) {
      const v = (rawBody as Record<string, unknown>)[k];
      if (v !== undefined && v !== null) payload[k] = v;
    }

    if (Object.keys(payload).length === 0) {
      return Response.json(
        { error: "aucun champ autorise (allowed: " + ALLOWED_FIELDS.join(", ") + ")" },
        { status: 400, headers: NO_STORE }
      );
    }

    if ("opp_status" in payload) {
      const s = String(payload.opp_status);
      if (!["1", "2", "3", "4", "5", "6", "7"].includes(s)) {
        return Response.json(
          { error: "opp_status invalide (codes Dolibarr 1..7)" },
          { status: 400, headers: NO_STORE }
        );
      }
    }
    if ("opp_percent" in payload) {
      const n = Number(payload.opp_percent);
      if (Number.isNaN(n) || n < 0 || n > 100) {
        return Response.json(
          { error: "opp_percent doit etre entre 0 et 100" },
          { status: 400, headers: NO_STORE }
        );
      }
    }
    if ("opp_amount" in payload) {
      const n = Number(payload.opp_amount);
      if (Number.isNaN(n) || n < 0) {
        return Response.json(
          { error: "opp_amount doit etre un nombre positif" },
          { status: 400, headers: NO_STORE }
        );
      }
    }
    if ("title" in payload) {
      const t = payload.title;
      if (typeof t !== "string" || t.trim().length === 0) {
        return Response.json(
          { error: "title doit etre une chaine non vide" },
          { status: 400, headers: NO_STORE }
        );
      }
    }
    if ("status" in payload) {
      const s = String(payload.status);
      if (!["0", "1", "2"].includes(s)) {
        return Response.json(
          { error: "status invalide (0=brouillon, 1=ouvert, 2=cloturé attendus)" },
          { status: 400, headers: NO_STORE }
        );
      }
    }
    for (const k of ["description", "note_public", "note_private"] as const) {
      if (k in payload && typeof payload[k] !== "string") {
        return Response.json(
          { error: `${k} doit etre une chaine` },
          { status: 400, headers: NO_STORE }
        );
      }
    }

    await updateProject(
      id,
      payload as Parameters<typeof updateProject>[1],
      cockpit.tenant
    );

    return Response.json(
      { ok: true, id, tenant_slug: cockpit.slug, updated: payload },
      { headers: NO_STORE }
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur Dolibarr" },
      { status: 502, headers: NO_STORE }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || !/^\d+$/.test(id)) {
      return Response.json({ error: "id projet invalide" }, { status: 400, headers: NO_STORE });
    }

    const cockpit = await resolveCockpitTenants(request);
    if (!cockpit.ok) {
      return Response.json({ error: cockpit.error }, { status: cockpit.status, headers: NO_STORE });
    }
    const tenantCfg = cockpit.tenant;

    // Body lu mais ignoré pour l'ACL (5G : hostname est l'autorité).
    await request.json().catch(() => null);

    // Bloc 5E — garde-fous SERVEUR : on revérifie l'état du projet et ses
    // dépendances avant suppression.
    const [project, proposals, invoices] = await Promise.all([
      getProject(id, tenantCfg),
      getProjectProposals(id, tenantCfg).catch(() => []),
      getProjectInvoices(id, tenantCfg).catch(() => []),
    ]);

    const blocked = evaluateDeleteGuards(project, proposals, invoices);
    if (blocked) {
      return Response.json(
        {
          error: "suppression refusee",
          reason: blocked,
          counts: { proposals: proposals.length, invoices: invoices.length },
        },
        { status: 409, headers: NO_STORE }
      );
    }

    await deleteProject(id, tenantCfg);
    return Response.json(
      { ok: true, id, tenant_slug: cockpit.slug },
      { headers: NO_STORE }
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur Dolibarr" },
      { status: 502, headers: NO_STORE }
    );
  }
}
