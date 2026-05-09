// V1.1.E — Proxy GET /api/invoices/[id]/pdf -> mybotia-business.
//
// Cible : tenants `mybotia_business`. Pour Dolibarr legacy, utiliser
// /api/documents/download?modulepart=facture&ref=FACxxx.

import { NextRequest } from "next/server";
import { proxyBusinessPdf } from "@/lib/business-pdf-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyBusinessPdf(request, "invoices", id);
}
