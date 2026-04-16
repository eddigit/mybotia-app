import { createContact, updateContact } from "@/lib/dolibarr";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.lastname || !body.socid) {
      return Response.json(
        { error: "lastname et socid sont requis" },
        { status: 400 }
      );
    }

    const newId = await createContact({
      firstname: body.firstname || "",
      lastname: body.lastname,
      socid: body.socid,
      email: body.email || "",
      phone_pro: body.phone_pro || "",
      phone_mobile: body.phone_mobile || "",
      poste: body.poste || "",
    });

    return Response.json({ id: newId }, { status: 201 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur creation contact" },
      { status: 502 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) {
      return Response.json({ error: "id requis" }, { status: 400 });
    }
    await updateContact(id, data);
    return Response.json({ success: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur mise a jour contact" },
      { status: 502 }
    );
  }
}
