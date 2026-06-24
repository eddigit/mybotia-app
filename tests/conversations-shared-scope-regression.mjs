import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const bridge = readFileSync(join(root, "src/lib/claude-bridge.ts"), "utf8");
const conversationsRoute = readFileSync(
  join(root, "src/app/api/conversations/route.ts"),
  "utf8"
);
const messageRoute = readFileSync(
  join(root, "src/app/api/conversations/[id]/messages/route.ts"),
  "utf8"
);
const thread = readFileSync(
  join(root, "src/components/conversations/ConversationThread.tsx"),
  "utf8"
);
const hooks = readFileSync(join(root, "src/hooks/use-api.ts"), "utf8");

assert.match(
  bridge,
  /tenant_slug=\$\{encodeURIComponent\(tenantSlug\)\}/,
  "bridge conversation listing must support tenant_slug scoping"
);

assert.match(
  conversationsRoute,
  /listConversations\(tenantSlug\)/,
  "conversation listing must use tenant scope, not per-user email scope"
);

assert.match(
  messageRoute,
  /getSessionMessages\(id,\s*100,\s*tenantSlug\)/,
  "message history must request messages with tenant scope"
);

assert.match(
  hooks,
  /senderEmail\?: string;/,
  "chat messages must expose senderEmail for human identity rendering"
);

assert.match(
  thread,
  /HumanAvatar/,
  "conversation thread must render a human avatar for each user message"
);

console.log("conversations shared scope regression checks passed");
