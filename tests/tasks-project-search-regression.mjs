import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const file = path.join(root, "src/app/tasks/page.tsx");
const source = fs.readFileSync(file, "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  source.includes("projectSearch") &&
    source.includes("Rechercher une affaire") &&
    source.includes("visibleProjectOptions"),
  "The task project filter must include a text search before the long affair/project selector."
);

assert(
  source.includes("Toutes les affaires") &&
    source.includes("setProjectSearch"),
  "The searchable project filter must keep the 'Toutes les affaires' option and update search text."
);

assert(
  !source.includes("activeProjects.slice(0, 8).map"),
  "The task filter must not hide projects behind the old first-8 button strip."
);

console.log("tasks project search regression OK");
