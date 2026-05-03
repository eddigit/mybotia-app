"use client";

// Card affichee en haut du thread quand une conversation est contextualisee
// par un client (issue d'un seedClient depuis /crm/[id]). Fetch la fiche
// client cote serveur via /api/clients/[id] pour afficher des compteurs
// (projets, devis, factures) et un bouton "Voir fiche client".
//
// Si le fetch echoue ou est lent, on affiche au minimum le nom client connu
// + bouton vers la fiche. Pas d'erreur bloquante.

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Mail,
  Phone,
  ExternalLink,
  FolderOpen,
  FileText,
  Receipt,
} from "lucide-react";

interface ClientFetchResult {
  client?: {
    id: string;
    company?: string;
    name?: string;
    email?: string;
    phone?: string;
    status?: string;
    tags?: string[];
  };
  projects?: unknown[];
  proposals?: unknown[];
  invoices?: unknown[];
}

export function ClientContextCard({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const [data, setData] = useState<ClientFetchResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchClient() {
      setLoading(true);
      try {
        const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}`);
        if (!res.ok) {
          if (!cancelled) setData(null);
          return;
        }
        const json: ClientFetchResult = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchClient();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const company =
    data?.client?.company || data?.client?.name || clientName;
  const email = data?.client?.email;
  const phone = data?.client?.phone;
  const status = data?.client?.status;
  const tags = data?.client?.tags;

  const nbProjects = data?.projects?.length ?? 0;
  const nbProposals = data?.proposals?.length ?? 0;
  const nbInvoices = data?.invoices?.length ?? 0;

  return (
    <div className="px-5 py-3 mx-6 mt-4 mb-2 bg-surface-2/60 border border-accent-primary/20">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex items-center justify-center w-9 h-9 shrink-0 bg-accent-primary/10 border border-accent-primary/15">
            <Building2 className="w-4 h-4 text-accent-glow" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">
                Contexte client
              </span>
              {status && (
                <span className="text-[9px] uppercase tracking-wide text-accent-glow font-bold">
                  {status}
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-text-primary truncate mt-0.5">
              {company}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
              {email && (
                <span className="inline-flex items-center gap-1 text-[10px] text-text-muted">
                  <Mail className="w-3 h-3" />
                  {email}
                </span>
              )}
              {phone && (
                <span className="inline-flex items-center gap-1 text-[10px] text-text-muted">
                  <Phone className="w-3 h-3" />
                  {phone}
                </span>
              )}
              {tags && tags.length > 0 && (
                <span className="inline-flex items-center gap-1.5 flex-wrap">
                  {tags.slice(0, 4).map((t) => (
                    <span
                      key={t}
                      className="px-1.5 py-0.5 bg-surface-3 text-[9px] text-text-muted font-mono"
                    >
                      #{t}
                    </span>
                  ))}
                </span>
              )}
            </div>
            {!loading && (
              <div className="flex items-center gap-3 mt-2 text-[10px]">
                <span className="inline-flex items-center gap-1 text-text-secondary">
                  <FolderOpen className="w-3 h-3 text-accent-glow" />
                  <span className="font-bold">{nbProjects}</span> projet{nbProjects > 1 ? "s" : ""}
                </span>
                <span className="inline-flex items-center gap-1 text-text-secondary">
                  <FileText className="w-3 h-3 text-accent-glow" />
                  <span className="font-bold">{nbProposals}</span> devis
                </span>
                <span className="inline-flex items-center gap-1 text-text-secondary">
                  <Receipt className="w-3 h-3 text-amber-300" />
                  <span className="font-bold">{nbInvoices}</span> facture{nbInvoices > 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>
        </div>
        <Link
          href={`/crm/${encodeURIComponent(clientId)}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent-primary/10 hover:bg-accent-primary/20 border border-accent-primary/30 text-accent-glow text-[10px] font-bold uppercase tracking-tight transition-all whitespace-nowrap shrink-0"
          title="Ouvrir la fiche client complete"
        >
          <ExternalLink className="w-3 h-3" />
          Voir fiche
        </Link>
      </div>
    </div>
  );
}
