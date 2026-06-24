import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

const avatars = read("src/lib/agent-avatars.ts");
const sharedHumanAvatar = read("src/components/shared/HumanAvatar.tsx");
const conversationsPage = read("src/app/conversations/page.tsx");
const conversationsWorkspace = read("src/components/conversations/ConversationsV4Workspace.tsx");
const hooks = read("src/hooks/use-api.ts");
const tasksRoute = read("src/app/api/tasks/route.ts");
const todayRoute = read("src/app/api/today/route.ts");
const taskPanel = read("src/components/tasks/TaskPanel.tsx");
const todayTasks = read("src/components/home/TodayTasksCard.tsx");

assert.match(
  avatars,
  /export function getHumanAvatar/,
  "human avatar resolution must be centralized"
);
assert.match(
  avatars,
  /sadd?jaad|sajad|omarjee/i,
  "Saddjaad must have a stable human avatar identity rule"
);
assert.match(
  sharedHumanAvatar,
  /getHumanAvatar/,
  "shared HumanAvatar component must use the centralized avatar registry"
);

assert.match(
  conversationsPage,
  /ConversationsV4Workspace/,
  "conversations page must delegate to the V4 workspace"
);
assert.match(
  conversationsWorkspace,
  /UserAvatarV4/,
  "V4 conversation rows/messages must show the user avatar"
);
assert.match(
  conversationsWorkspace,
  /projectRef/,
  "V4 conversations must preserve project context"
);
assert.match(
  conversationsWorkspace,
  /clientRef/,
  "V4 conversations must preserve client context"
);

for (const source of [hooks, tasksRoute, todayRoute]) {
  assert.match(source, /assigneeEmail/, "task payloads must expose assigneeEmail");
  assert.match(source, /assigneeName/, "task payloads must expose assigneeName");
}
assert.match(tasksRoute, /getTaskContacts/, "tasks route must read Dolibarr task contacts");
assert.match(todayRoute, /getTaskContacts/, "today route must read Dolibarr task contacts");
assert.match(taskPanel, /HumanAvatar/, "TaskPanel must render assignee avatar");
assert.match(todayTasks, /HumanAvatar/, "TodayTasksCard must render assignee avatar");

console.log("shared workspace MVP regression checks passed");
