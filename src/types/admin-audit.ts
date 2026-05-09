// V1.1.E — Type partagé pour les entrées audit_logs (client/serveur).
//
// Référence : route `/api/admin/tenants/[slug]/audit-log`.

export interface AdminAuditLogEntry {
  id: string;
  action: string;
  tableName: string;
  rowId: string;
  userId: string | null;
  userEmail: string | null;
  diff: unknown;
  createdAt: string;
}
