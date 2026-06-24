import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const file = path.join(root, "src/app/crm/[id]/page.tsx");
const source = fs.readFileSync(file, "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  source.includes("AccountActivitiesTable") &&
    source.includes("Activités du compte") &&
    source.includes("accountActivityRows"),
  "The CRM client sheet must expose one account activities table."
);

for (const label of ["Activité", "Type", "Date", "Statut", "Élément lié"]) {
  assert(source.includes(label), `The account activities table must expose '${label}'.`);
}

assert(
  !source.includes("Historique ({activities.length})"),
  "The old activities-only history block must not duplicate the account activities section."
);

console.log("crm account activities regression OK");
