// Page Conversations — refonte V4 server-first (2026-05-05).
// Backend : Postgres mybotia_memory.chat.* + bridge prod /chat (lecture seule).
// L'AppShell prod (sidebar + topbar globales) wrappe automatiquement cette page.
// Voir backup : page.tsx.bak-pre-int-v4-* pour rollback.

import { ConversationsV4Workspace } from "@/components/conversations/ConversationsV4Workspace";

export default function ConversationsPage() {
  return <ConversationsV4Workspace />;
}
