// Expose WhatsApp group names from the gateway
// Gateway runs on port 8010 locally
// Bloc 6B-final — gate par feature `whatsapp` du cockpit courant.

import { requireFeature } from "@/lib/tenant-features";

export async function GET(request: Request) {
  const featureCheck = await requireFeature(request, "whatsapp");
  if (!featureCheck.ok) return featureCheck.response;

  try {
    const res = await fetch("http://127.0.0.1:8010/groups", {
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      return Response.json({}, { status: 200 });
    }
    const groups = await res.json();
    return Response.json(groups);
  } catch {
    return Response.json({}, { status: 200 });
  }
}
