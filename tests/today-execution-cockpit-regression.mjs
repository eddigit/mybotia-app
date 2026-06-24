import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const todayPage = readFileSync(join(root, "src/app/today/page.tsx"), "utf8");
const todayRoute = readFileSync(join(root, "src/app/api/today/route.ts"), "utf8");
const hooks = readFileSync(join(root, "src/hooks/use-api.ts"), "utf8");
const createTaskModal = readFileSync(join(root, "src/components/tasks/CreateTaskModal.tsx"), "utf8");
const taskEditPanel = readFileSync(join(root, "src/components/tasks/TaskEditPanel.tsx"), "utf8");

assert.match(
  todayPage,
  /tasksByCollaborator/,
  "Today must group the daily execution tasks by collaborator.",
);

assert.match(
  todayPage,
  /doneTodayTasks/,
  "Today must expose tasks completed today for end-of-day review.",
);

assert.match(
  todayPage,
  /planningTasks/,
  "Today must expose tasks that need planning instead of letting them disappear.",
);

assert.match(
  todayPage,
  /title="Aujourd'hui par collaborateur"/,
  "Today must render the collaborator execution section as the main daily block.",
);

assert.match(
  todayPage,
  /title="Terminé aujourd'hui"/,
  "Today must render a completed-today section.",
);

assert.match(
  todayPage,
  /title="À planifier"/,
  "Today must render a planning hygiene section.",
);

for (const oldSection of [
  'title="Affaires en cours"',
  'title="Paiements à suivre"',
  'title="Flux récent"',
  'title="Alertes"',
]) {
  assert.ok(
    !todayPage.includes(oldSection),
    `Today must not keep the old duplicate section ${oldSection}.`,
  );
}

assert.match(
  todayPage,
  /body: JSON\.stringify\(\{ progress: "100" \}\)/,
  "Today should keep status completion as the only required write; business sets doneAt server-side.",
);

assert.match(
  hooks,
  /doneAt\?: string;/,
  "TaskItem must expose doneAt for completed-today filtering.",
);

assert.match(
  todayRoute,
  /doneAt:\s*t\.doneAt/,
  "Today business payload must forward task doneAt.",
);

for (const source of [todayPage, createTaskModal, taskEditPanel]) {
  assert.match(
    source,
    /saddjaad/,
    "Today execution flow must support Saddjaad as a task collaborator.",
  );
}

console.log("today execution cockpit regression OK");
