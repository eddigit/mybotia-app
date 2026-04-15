import { NextRequest } from "next/server";

const DOLIBARR_URL = process.env.DOLIBARR_URL!;
const DOLIBARR_API_KEY = process.env.DOLIBARR_API_KEY!;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const modulepart = searchParams.get("modulepart");
  const ref = searchParams.get("ref");

  if (!modulepart || !ref) {
    return Response.json(
      { error: "modulepart et ref sont requis" },
      { status: 400 }
    );
  }

  try {
    const originalFile = `${ref}/${ref}.pdf`;
    const res = await fetch(
      `${DOLIBARR_URL}/documents/download?modulepart=${encodeURIComponent(modulepart)}&original_file=${encodeURIComponent(originalFile)}`,
      {
        headers: { DOLAPIKEY: DOLIBARR_API_KEY },
      }
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return Response.json(
        { error: `Dolibarr download ${res.status}: ${text.slice(0, 300)}` },
        { status: 502 }
      );
    }

    const data = await res.json();

    // Dolibarr returns base64-encoded content
    if (data.content) {
      const buffer = Buffer.from(data.content, "base64");
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${data.filename || ref + ".pdf"}"`,
          "Content-Length": buffer.length.toString(),
        },
      });
    }

    return Response.json({ error: "Aucun contenu PDF" }, { status: 404 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur telechargement" },
      { status: 500 }
    );
  }
}
