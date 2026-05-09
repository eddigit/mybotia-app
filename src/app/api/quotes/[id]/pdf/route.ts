// V1.1.E — Proxy GET /api/quotes/[id]/pdf -> mybotia-business.
//
// Cible : tenants `mybotia_business`. Pour Dolibarr legacy, utiliser
// /api/documents/download?modulepart=propale&ref=DEVxxx.
//
// La logique métier est dans `lib/business-pdf-proxy.ts`. Cette route reste
// fine et ne fait que parser l'ID + déléguer.

import { NextRequest } from "next/server";
import { proxyBusinessPdf } from "@/lib/business-pdf-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyBusinessPdf(request, "quotes", id);
}
