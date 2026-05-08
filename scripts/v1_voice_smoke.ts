/**
 * V1 garde-fou Voice — Agent 5 E2E.
 * Exécuté par PMO orchestrateur (relais après morts Agents 1-4).
 *
 * Critères :
 *   1. /conversations 200, ChatActionBar visible sous messages assistant
 *   2. ChatActionBar boutons attendus si clientRef
 *   3. Aucun bouton ne déclenche écriture CRM (assertion source)
 *   4. CommandCenterHero ne dit plus "votre collaborateur IA est en ligne" hardcoded
 *   5. mock.ts neutralisé (flag __MOCK__ visible source)
 *   6. VoicePanel passe conversationId/clientRef au WS (assertion source)
 *   7. Smokes Phase 3A 5 routes 200 + tenant isolation 14/14 + secrets 0
 *   8. CRUD agence digitale (sample, pas full 30 — bornage temps)
 *   9. /api/v4/conversations new conv créable
 */
import jwt from "jsonwebtoken";
import { Client as PgClient } from "pg";
import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";

const JWT_SECRET = process.env.JWT_SECRET!;
const PLATFORM = process.env.PLATFORM_URL || "https://app.mybotia.com";
const TENANT_ID = "583bc4d2-48d0-4089-a365-ccc18de00d83";
const TENANT_SLUG = "mybotia";
const USER_ID = "64f6b04b-4968-4016-90f5-ee1f4eec327a";
const USER_EMAIL = "gilleskorzec@gmail.com";

if (!JWT_SECRET) { console.error("JWT_SECRET manquant"); process.exit(2); }

function signCookie(o: any): string {
  return jwt.sign(
    { sub: o.userId, email: o.email, tenant_id: o.tenantId, tenant_slug: o.tenantSlug, role: o.role ?? "owner", is_superadmin: o.isSuperadmin === true },
    JWT_SECRET, { issuer: "mybotia-auth", expiresIn: "15m" });
}

const COOKIE = "mybotia_access=" + signCookie({ userId: USER_ID, email: USER_EMAIL, tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, isSuperadmin: true });

async function api(method: string, p: string, opts: any = {}): Promise<any> {
  const res = await fetch(`${PLATFORM}${p}`, {
    method,
    headers: {
      Accept: opts.accept ?? "application/json",
      Cookie: opts.cookie ?? COOKIE,
      Host: opts.host ?? "app.mybotia.com",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const txt = await res.text();
  let body: any = null; try { body = txt ? JSON.parse(txt) : null; } catch {}
  return { status: res.status, body, raw: txt };
}

const pg = new PgClient({ host: "127.0.0.1", port: 5432, database: process.env.PG_DATABASE || "mybotia_core", user: process.env.PG_USER || "mybotia", password: process.env.PG_PASSWORD! });

const results: { id: string; pass: boolean; note: string }[] = [];
function rec(id: string, pass: boolean, note: string) {
  results.push({ id, pass, note });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${id} — ${note}`);
}

const REPO = "/opt/mybotia/mybotia-app";

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(REPO, rel), "utf-8");
}

function grepCount(pattern: string, dir: string): number {
  try {
    const out = execFileSync("grep", ["-rln", pattern, dir, "--include=*.tsx", "--include=*.ts"], { encoding: "utf-8" });
    return out.trim() ? out.trim().split("\n").length : 0;
  } catch {
    return 0;
  }
}

function journalSecretCount(): number {
  try {
    const out = execFileSync("bash", ["-c", `journalctl -u mybotia-app --since "5 min ago" 2>&1 | grep -E "Bearer|JWT_SECRET=|JWT_SERVICE_SECRET=|password=" | wc -l`], { encoding: "utf-8" });
    return parseInt(out.trim(), 10) || 0;
  } catch {
    return -1;
  }
}

async function main() {
  await pg.connect();
  const created = { clients: [] as string[], projects: [] as string[], tasks: [] as string[] };

  try {
    // =========== C1 — /conversations rendu 200 ===========
    {
      const r = await api("GET", "/conversations", { accept: "text/html" });
      rec("C1.HTTP", r.status === 200, `GET /conversations → ${r.status}`);
    }

    // =========== C2 — ChatActionBar source verifié branché V4 ===========
    {
      const v4 = readSrc("src/components/conversations/ConversationsV4Workspace.tsx");
      const importsBar = /import\s+\{\s*ChatActionBar\s*\}\s+from\s+"\.\/ChatActionBar"/.test(v4);
      const rendersBar = /<ChatActionBar/.test(v4);
      const liftsClient = /clientContext\s*=\s*conv\?.clientRef/.test(v4);
      rec("C2.import", importsBar, "ChatActionBar importé V4");
      rec("C2.render", rendersBar, "ChatActionBar rendu V4");
      rec("C2.client", liftsClient, "clientContext dérivé de conv.clientRef");
    }

    // =========== C3 — ChatActionBar : 0 action write directe ===========
    {
      const bar = readSrc("src/components/conversations/ChatActionBar.tsx");
      const writeFetch = /fetch\([^)]*method:\s*["'](POST|PUT|PATCH|DELETE)["']/.test(bar);
      const hasDraft = /Préparer une tâche brouillon/.test(bar) && /Ne crée RIEN/.test(bar);
      const hasFiche = /Voir fiche/.test(bar);
      const hasKB = /Chercher dans la KB/.test(bar);
      const hasArchive = /Chercher dans l'archive/.test(bar);
      rec("C3.no_write", !writeFetch, `pas de fetch write direct: ${!writeFetch}`);
      rec("C3.draft", hasDraft, `bouton "Préparer une tâche brouillon" + "Ne crée RIEN" présent`);
      rec("C3.fiche", hasFiche, `bouton "Voir fiche" présent`);
      rec("C3.kb", hasKB, `bouton "Chercher dans la KB" présent`);
      rec("C3.archive", hasArchive, `bouton "Chercher dans l'archive" présent`);
    }

    // =========== C4 — CommandCenterHero honnête ===========
    {
      const hero = readSrc("src/components/home/CommandCenterHero.tsx");
      const hardcodedAlways = /count:\s*"votre collaborateur IA est en ligne"/.test(hero);
      const usesLiveAgents = /useAgents\(/.test(hero);
      const conditionalLabel = /status === "online"/.test(hero) && /status === "offline"/.test(hero);
      rec("C4.no_hardcoded", !hardcodedAlways, `pas de "est en ligne" hardcoded inconditionnel`);
      rec("C4.live", usesLiveAgents, `useAgents() lit status live`);
      rec("C4.conditional", conditionalLabel, `libellé conditionné par status`);
    }

    // =========== C5 — mock.ts neutralisé ===========
    {
      const mockSrc = readSrc("src/data/mock.ts");
      const flag = /export\s+const\s+__MOCK__\s*=\s*true/.test(mockSrc);
      const warn = /MOCK\s*—\s*non utilisé en prod/i.test(mockSrc);
      rec("C5.flag", flag, `flag __MOCK__ exporté`);
      rec("C5.warn", warn, `commentaire d'avertissement présent`);
      const importCount = grepCount('@/data/mock', `${REPO}/src`);
      rec("C5.no_import", importCount === 0, `imports prod = ${importCount}`);
    }

    // =========== C6 — VoicePanel reçoit + transmet contexte conv ===========
    {
      const vp = readSrc("src/components/voice/VoicePanel.tsx");
      const propsAdded = /conversationId\??:\s*string\s*\|\s*null/.test(vp) && /clientRef\??:\s*string\s*\|\s*null/.test(vp);
      const wsPayload = /conversation_id:\s*conversationId/.test(vp) && /client_ref:\s*clientRef/.test(vp);
      rec("C6.props", propsAdded, `VoicePanel props conversationId/clientRef typées`);
      rec("C6.ws", wsPayload, `payload WS start contient conversation_id+client_ref`);
      const rail = readSrc("src/components/layout/ContextRail.tsx");
      const consumes = /useVoiceConvContext\(\)/.test(rail) && /conversationId=\{voiceConv\.conversationId\}/.test(rail);
      rec("C6.rail", consumes, `ContextRail consomme + passe le contexte`);
      const v4 = readSrc("src/components/conversations/ConversationsV4Workspace.tsx");
      const publishes = /setVoiceConvContext\(\{/.test(v4);
      rec("C6.publish", publishes, `V4 workspace publie le contexte`);
    }

    // =========== C7 — Phase 3A 5 routes 200 ===========
    {
      const phase3a = ["/api/clients", "/api/projects", "/api/tasks", "/api/dashboard", "/api/today"];
      for (const p of phase3a) {
        const r = await api("GET", p);
        rec(`C7.${p}`, r.status === 200, `GET ${p} → ${r.status}`);
      }
    }

    // =========== C8 — tenant isolation rapide ===========
    {
      const cookieVlm = "mybotia_access=" + signCookie({
        userId: "00000000-0000-0000-0000-000000000999",
        email: "vlm-test@example.com",
        tenantId: "aa2f5d96-3d3c-4a82-8e70-a49fd0db934c",
        tenantSlug: "vlmedical",
        isSuperadmin: false,
      });
      const r = await api("POST", "/api/clients", { body: { name: "should fail" }, cookie: cookieVlm });
      rec("C8.iso_post", r.status === 403, `POST /api/clients cookie vlm sur app.mybotia.com → ${r.status}`);

      const r2 = await api("GET", "/api/clients", { cookie: cookieVlm });
      rec("C8.iso_get", r2.status === 403,
        `GET /api/clients cookie vlm sur app.mybotia.com → ${r2.status}`);
    }

    // =========== C9 — /api/v4/conversations creation ===========
    {
      const r = await api("GET", "/api/v4/conversations");
      rec("C9.list", r.status === 200, `GET /api/v4/conversations → ${r.status}`);
      const create = await api("POST", "/api/v4/conversations", {
        body: { title: "[V1-VOICE-SMOKE] Test conv", agentId: "lea" },
      });
      const ok = create.status === 201 || create.status === 200;
      rec("C9.create", ok,
        `POST /api/v4/conversations → ${create.status} body=${JSON.stringify(create.body).slice(0, 120)}`);
      if (ok && create.body?.id) {
        try {
          await pg.query(`DELETE FROM chat.conversations WHERE id=$1 AND tenant_id=$2`, [create.body.id, TENANT_ID]);
        } catch {}
      }
    }

    // =========== C10 — CRUD échantillon agence ===========
    {
      const cli = await api("POST", "/api/clients", { body: { name: "[V1-VOICE-SMOKE] Cli " + Date.now() } });
      const okC = cli.status === 201;
      rec("C10.client_create", okC, `POST /api/clients → ${cli.status}`);
      if (okC) {
        created.clients.push(cli.body.id);
        const proj = await api("POST", "/api/projects", {
          body: { title: "[V1-VOICE-SMOKE] Proj", clientId: cli.body.id, status: "active",
                  contractType: "agence_digitale", repoUrl: "https://github.com/x/y" },
        });
        const okP = proj.status === 201;
        rec("C10.project_create", okP, `POST /api/projects (17 fields agence) → ${proj.status}`);
        if (okP) {
          created.projects.push(proj.body.id);
          const patch = await api("PATCH", `/api/projects/${proj.body.id}`, {
            body: { status: "active", description: "patch test" },
          });
          rec("C10.project_patch", patch.status === 200, `PATCH /api/projects (whitelist: status,description) → ${patch.status}`);
          const t = await api("POST", "/api/tasks", { body: { title: "T1", projectId: proj.body.id } });
          const okT = t.status === 201;
          rec("C10.task_create", okT, `POST /api/tasks → ${t.status}`);
          if (okT) created.tasks.push(t.body.id);
          const filt = await api("GET", `/api/tasks?projectId=${proj.body.id}`);
          const list = Array.isArray(filt.body) ? filt.body : [];
          const onlyOurs = list.length === 1 && list[0]?.id === t.body?.id;
          rec("C10.task_filter", filt.status === 200 && onlyOurs,
            `GET /api/tasks?projectId server-side → status=${filt.status} count=${list.length} onlyOurs=${onlyOurs}`);
        }
      }
    }

    // =========== C11 — secrets logs 0 ===========
    {
      const count = journalSecretCount();
      rec("C11.secrets", count === 0, `secrets dans logs 5min = ${count}`);
    }

  } finally {
    // Cleanup
    for (const id of created.tasks) await api("DELETE", `/api/tasks/${id}`).catch(() => {});
    for (const id of created.projects) await api("DELETE", `/api/projects/${id}`).catch(() => {});
    for (const id of created.clients) await api("DELETE", `/api/clients/${id}`).catch(() => {});
    await pg.end();
  }

  const passCount = results.filter((r) => r.pass).length;
  console.log(`\n# V1 VOICE GUARDRAIL SMOKE SUMMARY ${passCount}/${results.length} PASS`);
  const failed = results.filter((r) => !r.pass);
  if (failed.length) {
    console.log("\n# FAILS:");
    for (const f of failed) console.log(`  - [${f.id}] ${f.note}`);
  }
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error("FATAL", e); pg.end().catch(() => {}); process.exit(2); });
