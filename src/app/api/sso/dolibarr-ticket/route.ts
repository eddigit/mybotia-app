import { getSession } from "@/lib/session";
import { crmHostForTenant, issueDolibarrTicket } from "@/lib/sso";

const SUPPORTED_TENANTS = new Set(["mybotia", "vlmedical"]);

function isSafeTarget(target: string): boolean {
  if (!target.startsWith("/")) return false;
  if (target.startsWith("//")) return false;
  if (target.includes("\n") || target.includes("\r")) return false;
  return true;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Non authentifié" }, { status: 401 });
  }

  const url = new URL(request.url);
  const target = url.searchParams.get("target") || "/";
  if (!isSafeTarget(target)) {
    return Response.json({ error: "target invalide" }, { status: 400 });
  }

  const slug = session.tenantSlug;
  if (!SUPPORTED_TENANTS.has(slug)) {
    return Response.json(
      { error: `Tenant ${slug} hors stack standard CRM` },
      { status: 403 }
    );
  }

  const host = crmHostForTenant(slug);
  if (!host) {
    return Response.json({ error: "Tenant sans CRM mappé" }, { status: 403 });
  }

  try {
    const ticket = issueDolibarrTicket({
      email: session.email,
      tenantSlug: slug,
      target,
    });
    const loginUrl = `https://${host}/custom/mybotiasso/login.php?ticket=${encodeURIComponent(ticket)}`;
    return Response.json({ url: loginUrl, expiresIn: 60 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur émission ticket" },
      { status: 500 }
    );
  }
}
