"use client";

import { use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  User,
  FileText,
  FolderOpen,
  Clock,
  MessageSquare,
  Calendar,
  Settings2,
  Truck,
} from "lucide-react";
import { useClient } from "@/hooks/use-api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Activity } from "@/types";

const typeIcons: Record<string, typeof MessageSquare> = {
  message: MessageSquare,
  meeting: Calendar,
  system: Settings2,
};

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, loading, error } = useClient(id);

  if (loading) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted micro-label">Chargement du client...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <Link
          href="/crm"
          className="inline-flex items-center gap-2 text-text-muted hover:text-text-primary text-sm mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au CRM
        </Link>
        <div className="card-sharp p-8 text-center">
          <p className="text-text-muted">Client introuvable</p>
        </div>
      </div>
    );
  }

  const { client, contacts, activities, invoices, proposals, projects } = data;

  return (
    <div className="p-8 space-y-6">
      {/* Back link */}
      <Link
        href="/crm"
        className="inline-flex items-center gap-2 text-text-muted hover:text-text-primary text-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour au CRM
      </Link>

      {/* Header */}
      <div className="card-sharp p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-14 h-14 bg-accent-primary/10 border border-accent-primary/15">
              <Building2 className="w-7 h-7 text-accent-glow" />
            </div>
            <div>
              <h1 className="text-xl font-headline font-extrabold text-text-primary">
                {client.company}
              </h1>
              {client.name !== client.company && (
                <p className="text-sm text-text-secondary mt-0.5">
                  {client.name}
                </p>
              )}
              <div className="flex items-center gap-3 mt-2">
                <StatusBadge status={client.status} size="sm" dot />
                {client.isSupplier && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-tight text-amber-400 bg-amber-400/10 px-1.5 py-0.5">
                    <Truck className="w-3 h-3" />
                    Fournisseur
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {client.tags?.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-surface-4 text-[10px] text-text-muted font-mono"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* Contact info row */}
        <div className="flex flex-wrap gap-6 mt-5 pt-5 border-t border-white/[0.04]">
          {client.email && (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Mail className="w-4 h-4 text-text-muted" />
              {client.email}
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Phone className="w-4 h-4 text-text-muted" />
              {client.phone}
            </div>
          )}
          {client.town && (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <MapPin className="w-4 h-4 text-text-muted" />
              {client.town}
              {client.countryCode && ` (${client.countryCode})`}
            </div>
          )}
        </div>

        {/* Notes */}
        {(client.notePublic || client.notePrivate) && (
          <div className="mt-4 pt-4 border-t border-white/[0.04] space-y-2">
            {client.notePublic && (
              <p className="text-sm text-text-secondary leading-relaxed">
                {client.notePublic}
              </p>
            )}
            {client.notePrivate && (
              <p className="text-sm text-text-muted leading-relaxed italic">
                {client.notePrivate}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Grid: Contacts + Projects + Financials */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contacts */}
        <div className="card-sharp p-6">
          <div className="flex items-center gap-2 mb-5">
            <User className="w-4 h-4 text-accent-glow" />
            <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
              Contacts ({contacts.length})
            </h2>
          </div>
          {contacts.length === 0 ? (
            <p className="text-sm text-text-muted">Aucun contact</p>
          ) : (
            <div className="space-y-4">
              {contacts.map((c) => (
                <div
                  key={c.id}
                  className="p-3 bg-surface-1/50 border border-white/[0.04]"
                >
                  <p className="text-sm font-bold text-text-primary">
                    {c.name}
                  </p>
                  {c.role && (
                    <p className="text-[11px] text-accent-glow mt-0.5">
                      {c.role}
                    </p>
                  )}
                  {c.email && (
                    <p className="text-xs text-text-muted mt-1 flex items-center gap-1.5">
                      <Mail className="w-3 h-3" />
                      {c.email}
                    </p>
                  )}
                  {c.phone && (
                    <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1.5">
                      <Phone className="w-3 h-3" />
                      {c.phone}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Projects */}
        <div className="card-sharp p-6">
          <div className="flex items-center gap-2 mb-5">
            <FolderOpen className="w-4 h-4 text-accent-glow" />
            <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
              Projets ({projects.length})
            </h2>
          </div>
          {projects.length === 0 ? (
            <p className="text-sm text-text-muted">Aucun projet</p>
          ) : (
            <div className="space-y-3">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="p-3 bg-surface-1/50 border border-white/[0.04]"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      {p.ref && (
                        <span className="text-[10px] font-mono text-text-muted">
                          {p.ref}
                        </span>
                      )}
                      <p className="text-sm font-bold text-text-primary">
                        {p.name}
                      </p>
                    </div>
                    <StatusBadge status={p.status} size="xs" />
                  </div>
                  {p.budget !== undefined && p.budget > 0 && (
                    <p className="text-lg font-headline font-extrabold text-accent-glow mt-2">
                      {formatCurrency(p.budget)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Financials: Invoices + Proposals */}
        <div className="card-sharp p-6">
          <div className="flex items-center gap-2 mb-5">
            <FileText className="w-4 h-4 text-accent-glow" />
            <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
              Documents
            </h2>
          </div>

          {/* Proposals */}
          {proposals.length > 0 && (
            <div className="mb-4">
              <h3 className="micro-label text-text-muted mb-2">
                Devis ({proposals.length})
              </h3>
              <div className="space-y-2">
                {proposals.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2 bg-surface-1/50 border border-white/[0.04]"
                  >
                    <div>
                      <span className="text-xs font-bold text-text-primary">
                        {p.ref}
                      </span>
                      {p.date && (
                        <span className="text-[10px] text-text-muted ml-2">
                          {new Date(p.date).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-bold text-text-primary">
                      {formatCurrency(p.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invoices */}
          {invoices.length > 0 && (
            <div>
              <h3 className="micro-label text-text-muted mb-2">
                Factures ({invoices.length})
              </h3>
              <div className="space-y-2">
                {invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between p-2 bg-surface-1/50 border border-white/[0.04]"
                  >
                    <div>
                      <span className="text-xs font-bold text-text-primary">
                        {inv.ref}
                      </span>
                      {inv.date && (
                        <span className="text-[10px] text-text-muted ml-2">
                          {new Date(inv.date).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={inv.status} size="xs" />
                      <span className="text-sm font-bold text-text-primary">
                        {formatCurrency(inv.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {proposals.length === 0 && invoices.length === 0 && (
            <p className="text-sm text-text-muted">Aucun document</p>
          )}
        </div>
      </div>

      {/* Activity timeline */}
      {activities.length > 0 && (
        <div className="card-sharp p-6">
          <div className="flex items-center gap-2 mb-5">
            <Clock className="w-4 h-4 text-accent-glow" />
            <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
              Historique ({activities.length})
            </h2>
          </div>
          <div className="space-y-4">
            {activities.map((activity: Activity, i: number) => {
              const Icon = typeIcons[activity.type] || Settings2;
              return (
                <div
                  key={activity.id}
                  className={cn(
                    "relative pl-8 flex gap-3",
                    i < activities.length - 1 &&
                      "pb-4 border-l border-white/[0.06] ml-[7px]"
                  )}
                >
                  <div className="absolute left-0 top-0 w-4 h-4 rounded-full bg-surface-3 border border-white/[0.08] flex items-center justify-center">
                    <Icon className="w-2.5 h-2.5 text-text-muted" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm text-text-primary">
                        {activity.title}
                      </span>
                      <span className="text-[10px] text-text-muted font-mono shrink-0">
                        {new Date(activity.timestamp).toLocaleDateString(
                          "fr-FR",
                          { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
                        )}
                      </span>
                    </div>
                    {activity.description && (
                      <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                        {activity.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
