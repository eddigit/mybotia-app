import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const createTaskModal = readFileSync(join(root, "src/components/tasks/CreateTaskModal.tsx"), "utf8");
const projectDetailPanel = readFileSync(join(root, "src/components/crm/ProjectDetailPanel.tsx"), "utf8");
const tasksPage = readFileSync(join(root, "src/app/tasks/page.tsx"), "utf8");
const todayPage = readFileSync(join(root, "src/app/today/page.tsx"), "utf8");
const productionDetailPage = readFileSync(join(root, "src/app/productions/[id]/page.tsx"), "utf8");

assert.match(
  createTaskModal,
  /defaultProjectId\?: string;/,
  "CreateTaskModal must accept a default project id for contextual task creation.",
);

assert.match(
  createTaskModal,
  /defaultDueDate\?: string;/,
  "CreateTaskModal must accept a default due date so tasks created from Today reappear in Today.",
);

assert.match(
  createTaskModal,
  /lockProject\?: boolean;/,
  "CreateTaskModal must be able to lock the project when opened from a project/production.",
);

assert.match(
  projectDetailPanel,
  /defaultProjectId=\{project\.id\}/,
  "Project detail task creation must be pre-linked to the opened project.",
);

assert.match(
  projectDetailPanel,
  /lockProject/,
  "Project detail task creation must lock the project to prevent accidental misfiling.",
);

assert.match(
  tasksPage,
  /defaultProjectId=\{projectFilter !== "all" \? projectFilter : undefined\}/,
  "Tasks page must prefill the selected project filter when creating a task.",
);

assert.match(
  todayPage,
  /defaultDueDate=\{today\}/,
  "Today page must create new tasks with today's due date by default.",
);

assert.match(
  productionDetailPage,
  /\/api\/tasks\?projectId=/,
  "Production detail must fetch tasks linked to the production/project id.",
);

assert.match(
  productionDetailPage,
  /defaultProjectId=\{production\.id\}/,
  "Production detail task creation must be pre-linked to the opened production.",
);

assert.match(
  productionDetailPage,
  /Tâches de production/,
  "Production detail must render a production tasks section.",
);

console.log("task context visibility regression OK");
