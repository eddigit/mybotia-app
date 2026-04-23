import { createFolder, listFolders } from "@/lib/claude-bridge";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Non authentifie" }, { status: 401 });
    }
    const folders = await listFolders(session.email);
    return Response.json(folders);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur dossiers" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Non authentifie" }, { status: 401 });
    }
    const body = (await request.json()) as { name?: string };
    const name = (body.name || "").trim();
    if (!name) {
      return Response.json({ error: "name_required" }, { status: 400 });
    }
    const folder = await createFolder(session.email, name);
    return Response.json(folder);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur creation dossier" },
      { status: 500 }
    );
  }
}
