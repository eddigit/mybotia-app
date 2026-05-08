"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Mail,
  Phone,
  Globe,
  ExternalLink,
  FileText,
  Receipt,
  CheckSquare,
  Send,
  Paperclip,
} from "lucide-react";
import { UserAvatarV4 } from "../UserAvatarV4";

interface ClientFetchResult {
  client?: {
    id: string;
    company?: string;
    name?: string;
    email?: string;
    phone?: string;
    website?: string;
    status?: string;
    tags?: string[];
    avatarUrl?: string | null;
    logoUrl?: string | null;
    lastContactAt?: string | null;
  };
  projects?: Array<{ id: string; name: string }>;
  proposals?: unknown[];
  invoices?: unknown[];
}

/**
 * Carte de visite client premium — V4. Future-ready :
 * - props minimales : clientRef ou clientId
 * - fetch /api/clients/[id] (lecture seule, déjà en prod)
 * - fallback initiales / logo typographique si pas de média
 * - actions rapides (déclenchent des handlers fournis ou liens vers CRM)
 *
 * Si aucun client lié, état vide propre.
 */
export function ClientBusinessCardV4({
  clientRef,
  clientName,
  onCreateQuote,
  onCreateTask,
  onSendEmail,
  onAttachDoc,
}: {
  clientRef?: string | null;
  clientName?: string | null;
  onCreateQuote?: () => void;
  onCreateTask?: () => void;
  onSendEmail?: () => void;
  onAttachDoc?: () => void;
}) {
  const [data, setData] = useState<ClientFetchResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clientRef) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/clients/${encodeURIComponent(clientRef)}`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && setData(d as ClientFetchResult))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [clientRef]);

  if (!clientRef) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface-1 p-4 text-center">
        <Building2
          size={24}
          strokeWidth={1.2}
          className="mx-auto mb-2 text-text-muted"
        />
        <div className="text-sm text-text-secondary">Aucun client lié</div>
        <div className="text-[11px] text-text-muted mt-1">
          Lier une fiche CRM à cette conversation pour voir le contexte client
          ici.
        </div>
      </div>
    );
  }

  const client = data?.client;
  const displayName =
    client?.name ?? client?.company ?? clientName ?? clientRef;
  const subtitle = client?.company && client.name ? client.company : null;

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-1 p-4 motion-safe:animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          {client?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={client.avatarUrl}
              alt={displayName}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <UserAvatarV4
              email={client?.email}
              name={displayName}
              size={48}
              className="rounded-full"
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-text-primary truncate">
              {displayName}
            </span>
            {client?.status && (
              <span className="text-[10px] uppercase tracking-wider text-text-muted px-1.5 py-0.5 rounded bg-surface-3/60">
                {client.status}
              </span>
            )}
          </div>
          {subtitle && (
            <div className="text-[11px] text-text-muted truncate">
              {subtitle}
            </div>
          )}
          {!loading && (
            <div className="mt-2 flex flex-col gap-1 text-[11px] text-text-secondary">
              {client?.email && (
                <a
                  href={`mailto:${client.email}`}
                  className="flex items-center gap-1.5 hover:text-text-primary transition-colors"
                >
                  <Mail size={12} strokeWidth={1.5} />
                  <span className="truncate">{client.email}</span>
                </a>
              )}
              {client?.phone && (
                <a
                  href={`tel:${client.phone}`}
                  className="flex items-center gap-1.5 hover:text-text-primary transition-colors"
                >
                  <Phone size={12} strokeWidth={1.5} />
                  <span>{client.phone}</span>
                </a>
              )}
              {client?.website && (
                <a
                  href={client.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-text-primary transition-colors"
                >
                  <Globe size={12} strokeWidth={1.5} />
                  <span className="truncate">{client.website}</span>
                </a>
              )}
            </div>
          )}
        </div>

        <Link
          href={`/crm/${encodeURIComponent(clientRef)}`}
          aria-label="Ouvrir la fiche client"
          className="shrink-0 p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
        >
          <ExternalLink size={14} strokeWidth={1.5} />
        </Link>
      </div>

      {/* Actions rapides */}
      <div className="mt-3 grid grid-cols-2 gap-1.5 text-[11px]">
        <ActionMicroButton
          icon={<Receipt size={12} strokeWidth={1.5} />}
          label="Créer devis"
          onClick={onCreateQuote}
        />
        <ActionMicroButton
          icon={<CheckSquare size={12} strokeWidth={1.5} />}
          label="Créer tâche"
          onClick={onCreateTask}
        />
        <ActionMicroButton
          icon={<Send size={12} strokeWidth={1.5} />}
          label="Envoyer email"
          onClick={onSendEmail}
        />
        <ActionMicroButton
          icon={<Paperclip size={12} strokeWidth={1.5} />}
          label="Joindre doc"
          onClick={onAttachDoc}
        />
      </div>

      {/* Compteurs CRM si dispo */}
      {(data?.projects || data?.proposals || data?.invoices) && (
        <div className="mt-3 pt-3 border-t border-border-subtle flex gap-4 text-[11px] text-text-muted">
          {data.projects && (
            <span className="flex items-center gap-1">
              <FileText size={11} strokeWidth={1.5} />
              <span>{data.projects.length} projet(s)</span>
            </span>
          )}
          {data.proposals && (
            <span className="flex items-center gap-1">
              <Receipt size={11} strokeWidth={1.5} />
              <span>{(data.proposals as unknown[]).length} devis</span>
            </span>
          )}
          {data.invoices && (
            <span className="flex items-center gap-1">
              <Receipt size={11} strokeWidth={1.5} />
              <span>{(data.invoices as unknown[]).length} facture(s)</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function ActionMicroButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  const disabled = !onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-border-subtle bg-surface-2/50 text-text-secondary hover:bg-surface-2 hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}
