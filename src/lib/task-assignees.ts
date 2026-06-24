import type { DolibarrTaskContact } from "@/lib/dolibarr";

export interface TaskAssignee {
  assigneeId?: string;
  assigneeName?: string;
  assigneeEmail?: string;
}

function contactName(contact: DolibarrTaskContact): string | undefined {
  const name = [
    contact.firstname,
    contact.lastname,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  return (
    name ||
    contact.libelle ||
    contact.login ||
    contact.email ||
    undefined
  );
}

export function taskAssigneeFromContacts(
  contacts: DolibarrTaskContact[]
): TaskAssignee {
  const assignee =
    contacts.find(
      (contact) =>
        contact.source === "internal" && contact.code === "TASKEXECUTIVE"
    ) ||
    contacts.find((contact) => contact.source === "internal") ||
    contacts.find((contact) => contact.code === "TASKEXECUTIVE");

  if (!assignee) return {};

  return {
    assigneeId: assignee.id || assignee.rowid,
    assigneeName: contactName(assignee),
    assigneeEmail: assignee.email || undefined,
  };
}
