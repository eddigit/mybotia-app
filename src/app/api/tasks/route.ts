// Tasks: Dolibarr doesn't have project tasks configured yet.
// Return mock data for now, will be replaced when Dolibarr tasks are populated.

import { tasks } from "@/data/mock";

export async function GET() {
  return Response.json(tasks);
}
