const DOLIBARR_URL = process.env.DOLIBARR_URL!;
const DOLIBARR_API_KEY = process.env.DOLIBARR_API_KEY!;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { modulepart, ref, doctemplate } = body as {
      modulepart: string;
      ref: string;
      doctemplate?: string;
    };

    if (!modulepart || !ref) {
      return Response.json(
        { error: "modulepart et ref sont requis" },
        { status: 400 }
      );
    }

    // Map modulepart to Dolibarr expected values
    const moduleMap: Record<string, string> = {
      facture: "facture",
      propale: "propale",
      propal: "propale",
    };
    const doliModule = moduleMap[modulepart] || modulepart;

    // Default templates per module
    const defaultTemplates: Record<string, string> = {
      facture: "sponge",
      propale: "cyan",
    };
    const template = doctemplate || defaultTemplates[doliModule] || "crabe";

    const res = await fetch(`${DOLIBARR_URL}/documents/builddoc`, {
      method: "PUT",
      headers: {
        DOLAPIKEY: DOLIBARR_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        modulepart: doliModule,
        original_file: `${ref}/${ref}.pdf`,
        doctemplate: template,
        langcode: "fr_FR",
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return Response.json(
        { error: `Dolibarr builddoc ${res.status}: ${text.slice(0, 300)}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    return Response.json({
      filename: data.filename || `${ref}.pdf`,
      content: data.content || null,
      filesize: data.filesize || 0,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur generation PDF" },
      { status: 500 }
    );
  }
}
