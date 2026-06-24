import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const taskPanel = readFileSync(join(root, "src/components/tasks/TaskPanel.tsx"), "utf8");
const tasksPage = readFileSync(join(root, "src/app/tasks/page.tsx"), "utf8");

assert.match(
  taskPanel,
  /Trash2/,
  "TaskPanel must expose a trash action when tasks are selected",
);

assert.match(
  taskPanel,
  /selectedTaskIds/,
  "TaskPanel must keep a multi-selection state for checked tasks",
);

assert.match(
  taskPanel,
  /type="checkbox"/,
  "TaskPanel must render task selection checkboxes",
);

assert.match(
  taskPanel,
  /confirm\(/,
  "Bulk delete must ask for confirmation before deleting selected tasks",
);

assert.match(
  taskPanel,
  /onDeleteTasks/,
  "TaskPanel must delegate deletion to the parent page",
);

assert.match(
  tasksPage,
  /async function handleDeleteTasks/,
  "Tasks page must implement bulk deletion via the existing task delete API",
);

assert.match(
  tasksPage,
  /method:\s*"DELETE"/,
  "Bulk deletion must call DELETE on the task API",
);

console.log("task bulk delete regression OK");
