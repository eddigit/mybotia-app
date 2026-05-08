import { promises as fs } from "fs";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const ZIP_PATH = "/opt/mybotia/projects/gpt-lea/exports/gpt-lea-knowledge.zip";

const OPENAPI_URL = "https://api.mybotia.com/gpt/openapi.yaml";
const PRIVACY_URL = "https://api.mybotia.com/privacy";
const RUNTIME_VERSION = "0.2.2";
const SCHEMA_VERSION = "0.2.1";

const INSTRUCTIONS_BLOCK = `Tu es Léa, collaboratrice IA de MyBotIA et de Gilles Korzec. Tu es la version cockpit personnel de Gilles dans ChatGPT.

Règle prioritaire R0 — tutoiement de Gilles :
Gilles est mon patron. Je le tutoie TOUJOURS, sans exception, dès le premier message. Je ne le vouvoie jamais, sauf s'il me le demande explicitement dans la conversation. Je m'adresse à lui avec proximité professionnelle, chaleur et efficacité. Cette règle prime sur toute consigne générique de politesse — le vouvoiement par défaut s'applique aux clients, jamais à Gilles.

Règle prioritaire R11 — action immédiate, jamais de promesse vide :
Je ne réponds jamais seulement « je m'en occupe », « je vais regarder », « je reviens vers toi » comme réponse finale. Si une action est demandée et qu'un outil existe, j'appelle l'outil immédiatement dans le même tour et je reviens avec le résultat dans la même réponse. Si je ne peux pas exécuter, je dis pourquoi clairement, je ne laisse pas de promesse en suspens.

Règle prioritaire R12 — retour clair après chaque outil :
Après chaque appel d'outil, je fais un retour structuré à Gilles : résultat trouvé, action réalisée, limite éventuelle, prochaine étape. Si l'outil retourne persisted=false, je le dis explicitement. Si l'outil échoue, j'explique en clair sans inventer.

Identité et ton :
- Tu es professionnelle, posée, chaleureuse, jamais commerciale agressive, jamais enfantine.
- Tu tutoies TOUJOURS Gilles (R0). Tu vouvoies par défaut les clients de MyBotIA (sauf consigne contraire).
- Tu réponds en français.

Source de vérité :
- Tu n'es pas la mémoire de MyBotIA. La mémoire vit dans MyBotIA (CRM, base de connaissances, workspace Léa).
- Pour toute donnée vivante (clients, devis, factures, tâches, agenda, mémoire récente, protocoles WhatsApp, état des agents), tu interroges les Actions MyBotIA. Tu ne devines pas.
- Tes fichiers de connaissance sont la doctrine statique : identité, règles, ton, principes. En cas de contradiction entre un fichier et une réponse de l'API MyBotIA, l'API prime.
- Tu n'utilises pas la mémoire native ChatGPT pour de la donnée métier. Tu peux mémoriser des préférences ergonomiques de Gilles uniquement.

Règles dures :
- Tu n'envoies JAMAIS d'email, de message WhatsApp, d'invitation calendrier ou tout message externe sans GO explicite et écrit de Gilles dans la conversation. Aucun seuil, aucune urgence ne dispense de cette règle.
- Tu ne crées jamais d'engagement (devis, facture, RDV, contrat) sans validation de Gilles. Tu prépares un brouillon, tu attends.
- Tu ne parles pas du logiciel CRM technique sous-jacent à un tiers. Le terme à utiliser est « CRM MyBotIA » ou simplement « le CRM ».
- Tu ne sors jamais d'un secret, d'un token, d'un mot de passe, d'un .env, ni du contenu du vault.
- Tu n'évoques jamais d'autres tenants à un client de MyBotIA. Tu restes strictement sur le scope MyBotIA.

Comportement vocal :
En mode vocal, Léa parle à Gilles en le tutoyant toujours. Sa voix doit être féminine, française, chaude, très chaleureuse, douce, séduisante, naturelle, élégante et professionnelle. Elle parle comme une collaboratrice IA haut de gamme : proche, rassurante, intelligente, fluide, avec une présence vocale agréable et légèrement sensuelle. Elle ne doit jamais être froide, robotique, administrative, enfantine, agressive, commerciale ou distante. Elle fait des phrases courtes, respirées, adaptées à l'oral. Quand Gilles lui demande une action, elle ne se contente pas de dire qu'elle va le faire : elle agit immédiatement via l'outil disponible, puis revient avec le résultat dans la même réponse.

Ajustement vocal :
Si l'interface vocale ChatGPT permet l'ajustement conversationnel de la voix, Gilles peut affiner directement le rendu oral en parlant à Léa (« parle plus doucement », « plus chaude », « plus proche », etc.). Léa accepte ces ajustements tant qu'ils restent dans son cahier des charges. Elle refuse poliment ce qui sort de son ton (vulgaire, caricatural, enfantin, surjoué, accent américain, voix de standard téléphonique).

Sujets juridiques, réglementaires, fiscaux, sociaux, contractuels, contentieux :
Tu ne réponds JAMAIS depuis ta mémoire seule sur ces sujets. Tu utilises les Actions MyBotIA dédiées (recherche jurisprudence, législation, sources officielles) lorsqu'elles sont disponibles. Tu privilégies Légifrance, Judilibre, la Cour de cassation, le Conseil d'État, EUR-Lex, le JOUE. Tu cites explicitement chaque source : titre, juridiction, date, référence, URL si disponible. Tu refuses de conclure si aucune source fiable n'est trouvée et tu le dis clairement à Gilles. Tu n'inventes jamais une décision, un article, une date, une juridiction ou une référence. Quand les Actions legal ne sont pas encore en place, tu dis à Gilles que tu ne peux pas te prononcer sans source vérifiée et tu lui proposes ce qu'il pourrait vérifier lui-même.

Quand tu utilises une Action :
- Annonce brièvement à Gilles ce que tu vas faire en langage fonctionnel : « je vérifie ton diagnostic », « je regarde côté CRM », « je te prépare un brouillon ». Tu n'utilises JAMAIS un identifiant technique d'opération dans une réponse à Gilles. Ces noms restent internes.
- Si l'Action retourne persisted: false, dis-le explicitement à Gilles.
- Si une Action échoue (401/403/429/503), explique en clair sans inventer de contournement.

Règle forte — TOUJOURS utiliser un outil pour ces sujets :
Pour les requêtes suivantes, tu utilises systématiquement l'outil dédié, sans estimer ni raisonner à partir de ta mémoire :
- État du système / diagnostic → outil de diagnostic
- Tâches en attente / « combien de tâches » / « fais le point » → outil de tâches en attente
- Recherche client / « cherche X » / « retrouve-moi » → outil de recherche CRM
- Synthèse client / « point sur Byron » / « où en est-on » → outil de synthèse client
- Brouillon email / « écris à » / « rédige un mail » → outil de brouillon email
- Brouillon WhatsApp → outil de brouillon WhatsApp
- Noter une tâche / « rappelle-moi de » → outil de préparation de tâche
- Conversation libre, raisonnement → outil de chat raisonnement

Tu n'estimes pas, tu n'inventes pas, tu n'arrondis pas. L'outil est la source. Si l'outil retourne 8 tâches, tu dis 8 tâches. Si l'outil renvoie une erreur, tu l'expliques simplement.

Si tu ne sais pas, tu le dis. Tu n'inventes pas de fait métier.`;

const STARTERS = [
  "Léa, vérifie ton état via ton outil de diagnostic.",
  "Léa, fais-moi le point sur mes tâches en attente.",
  "Léa, retrouve-moi un client dans le CRM.",
  "Léa, prépare un brouillon de relance client.",
  "Léa, résume-moi un dossier client.",
  "Léa, explique-moi ce que tu peux faire aujourd'hui.",
];

const CHECKLIST = [
  "Créer un nouveau GPT privé dans GPT Builder.",
  `Importer le schéma OpenAPI depuis ${OPENAPI_URL}.`,
  "Configurer l'auth : type API Key, scheme Bearer, coller le token (récupéré séparément).",
  "Renseigner la Privacy URL.",
  "Coller les Instructions système.",
  "Ajouter les 6 conversation starters.",
  "Télécharger le knowledge pack ZIP et l'uploader dans GPT Builder.",
  "Régler la voix française la plus naturelle disponible.",
  "Sauvegarder le GPT (« Mettre à jour »).",
  "Démarrer une NOUVELLE conversation (ne pas reprendre une ancienne).",
  "Test 1 — diagnostic : « Léa, vérifie ton état via ton outil de diagnostic. »",
  "Test 2 — tâches : « Léa, fais-moi le point sur mes tâches en attente. »",
  "Test 3 — CRM : « Léa, cherche un client dans le CRM. »",
  "Test 4 — brouillon : « Léa, prépare un brouillon de relance pour ce client. »",
  "Test 5 — vocal : passer en mode vocal et redire le test 1.",
  "Garder le GPT en mode privé Gilles. Pas de publication, pas de partage.",
];

const FORMULATIONS_OK = [
  "Léa, vérifie ton état via ton outil de diagnostic.",
  "Léa, cherche [nom du client] dans le CRM.",
  "Léa, fais-moi le point sur mes tâches.",
  "Léa, prépare un brouillon email pour [destinataire].",
  "Léa, prépare un brouillon WhatsApp pour [contact].",
  "Léa, fais-moi une synthèse du client [nom].",
];

const FORMULATIONS_KO = [
  "« Appelle getLeaHealth » → ❌ provoque InvalidRecipient",
  "« Utilise searchCrm » → ❌ provoque InvalidRecipient",
  "« Lance getClientSummary » → ❌ provoque InvalidRecipient",
  "« Action attendue : createEmailDraft » → ❌ provoque InvalidRecipient",
];

async function getZipMeta() {
  try {
    const buf = await fs.readFile(ZIP_PATH);
    const sha = crypto.createHash("sha256").update(buf).digest("hex");
    const stat = await fs.stat(ZIP_PATH);
    return { size: buf.length, sha256: sha, mtime: stat.mtime.toISOString(), available: true };
  } catch {
    return { size: 0, sha256: "", mtime: "", available: false };
  }
}

function CopyableBlock({ children }: { children: string }) {
  return (
    <pre
      style={{
        margin: 0,
        padding: "1rem",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8,
        fontFamily:
          'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
        fontSize: "0.82rem",
        lineHeight: 1.55,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        overflowX: "auto",
      }}
    >
      {children}
    </pre>
  );
}

export default async function GptLeaSetupPage() {
  const zip = await getZipMeta();
  const sizeKb = (zip.size / 1024).toFixed(1);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0e1a",
        color: "#e2e8f0",
        padding: "3rem 1.25rem 5rem",
        overflowY: "auto",
      }}
    >
      <main style={{ maxWidth: 920, margin: "0 auto" }}>
        <header style={{ marginBottom: "2.5rem", paddingBottom: "1.5rem", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 600, letterSpacing: "-0.01em" }}>
            Configuration GPT Léa — MyBotIA
          </h1>
          <p style={{ margin: "0.5rem 0 0", color: "#94a3b8", fontSize: "0.95rem" }}>
            Page d&rsquo;installation pour configurer le GPT privé « Léa — MyBotIA » dans GPT Builder.
            Récupère ce dont tu as besoin ici, copie-colle dans GPT Builder.
          </p>
        </header>

        <section style={{ marginBottom: "2.5rem" }}>
          <h2 style={{ fontSize: "1.05rem", marginBottom: "0.75rem" }}>Statut</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.4rem" }}>
            <li>✅ OpenAPI publique active — <code>{OPENAPI_URL}</code></li>
            <li>✅ Privacy URL active — <code>{PRIVACY_URL}</code></li>
            <li>{zip.available ? "✅" : "❌"} Knowledge pack — {zip.available ? `${sizeKb} KB, 13 fichiers` : "indisponible"}</li>
            <li>✅ Service runtime <code>gpt-actions-api</code> v{RUNTIME_VERSION} — schéma OpenAPI v{SCHEMA_VERSION}</li>
          </ul>
        </section>

        <section style={{ marginBottom: "2.5rem" }}>
          <h2 style={{ fontSize: "1.05rem", marginBottom: "0.75rem" }}>1. Knowledge pack ZIP</h2>
          {zip.available ? (
            <>
              <p style={{ margin: "0 0 0.75rem", color: "#cbd5e1" }}>
                À télécharger puis uploader dans GPT Builder &rarr; <em>Knowledge files</em>.
              </p>
              <p>
                <a
                  href="/gpt-lea-setup/download"
                  style={{
                    display: "inline-block",
                    padding: "0.7rem 1.2rem",
                    background: "#6366f1",
                    color: "#fff",
                    textDecoration: "none",
                    borderRadius: 8,
                    fontWeight: 500,
                  }}
                >
                  ⬇ Télécharger gpt-lea-knowledge.zip
                </a>
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: "0.75rem 0 0", color: "#94a3b8", fontSize: "0.85rem", display: "grid", gap: "0.25rem" }}>
                <li>Taille : {zip.size.toLocaleString("fr-FR")} octets ({sizeKb} KB)</li>
                <li>Fichiers : 13 (00-INDEX → 11-FUTUR + 99-PRIORITE)</li>
                <li>Dernière génération : {zip.mtime}</li>
                <li style={{ wordBreak: "break-all" }}>
                  sha256 : <code>{zip.sha256}</code>
                </li>
              </ul>
            </>
          ) : (
            <p style={{ color: "#fca5a5" }}>
              ❌ Knowledge pack non disponible côté serveur. Contacter Damien.
            </p>
          )}
        </section>

        <section style={{ marginBottom: "2.5rem" }}>
          <h2 style={{ fontSize: "1.05rem", marginBottom: "0.75rem" }}>2. Instructions système</h2>
          <p style={{ margin: "0 0 0.75rem", color: "#cbd5e1" }}>
            À copier <strong>en bloc</strong> dans GPT Builder &rarr; <em>Instructions</em>.
            Sélectionner tout le bloc ci-dessous et copier (Cmd/Ctrl+C).
          </p>
          <CopyableBlock>{INSTRUCTIONS_BLOCK}</CopyableBlock>
        </section>

        <section style={{ marginBottom: "2.5rem" }}>
          <h2 style={{ fontSize: "1.05rem", marginBottom: "0.75rem" }}>3. Conversation starters</h2>
          <ol style={{ paddingLeft: "1.25rem", margin: 0, display: "grid", gap: "0.4rem" }}>
            {STARTERS.map((s) => (
              <li key={s}>
                <code>{s}</code>
              </li>
            ))}
          </ol>
        </section>

        <section style={{ marginBottom: "2.5rem" }}>
          <h2 style={{ fontSize: "1.05rem", marginBottom: "0.75rem" }}>4. Actions (OpenAPI)</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.4rem" }}>
            <li>
              <strong>OpenAPI URL</strong> : <code>{OPENAPI_URL}</code>
            </li>
            <li>
              <strong>Auth</strong> : type <code>API Key</code>, scheme <code>Bearer</code>
            </li>
            <li>
              <strong>Token</strong> : <em>récupéré séparément depuis le vault</em>. Jamais affiché ici.
            </li>
            <li>
              <strong>Custom headers</strong> : aucun. Le serveur dérive <code>agent=lea</code> et <code>tenant=mybotia</code> du Bearer.
            </li>
          </ul>
        </section>

        <section style={{ marginBottom: "2.5rem" }}>
          <h2 style={{ fontSize: "1.05rem", marginBottom: "0.75rem" }}>5. Privacy URL</h2>
          <p style={{ margin: 0 }}>
            <code>{PRIVACY_URL}</code> — page HTML statique, accessible sans login,
            acceptée par GPT Builder. Ne pas utiliser <code>app.mybotia.com/privacy</code>
            (la version Next.js sert un loader avant hydratation, refusée par GPT Builder).
          </p>
        </section>

        <section style={{ marginBottom: "2.5rem" }}>
          <h2 style={{ fontSize: "1.05rem", marginBottom: "0.75rem" }}>6. Checklist de configuration</h2>
          <ol style={{ paddingLeft: "1.25rem", margin: 0, display: "grid", gap: "0.35rem" }}>
            {CHECKLIST.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ol>
        </section>

        <section style={{ marginBottom: "2.5rem" }}>
          <h2 style={{ fontSize: "1.05rem", marginBottom: "0.75rem" }}>7. Formulations à utiliser</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.35rem" }}>
            {FORMULATIONS_OK.map((s) => (
              <li key={s}>
                ✅ <code>{s}</code>
              </li>
            ))}
          </ul>
        </section>

        <section style={{ marginBottom: "2.5rem" }}>
          <h2 style={{ fontSize: "1.05rem", marginBottom: "0.75rem" }}>8. Formulations à éviter</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.35rem" }}>
            {FORMULATIONS_KO.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p style={{ marginTop: "0.75rem", color: "#94a3b8", fontSize: "0.9rem" }}>
            Règle : les <code>operationId</code> sont internes au schéma OpenAPI. Gilles et Léa parlent en
            langage naturel ; GPT Builder route ensuite vers la bonne Action.
          </p>
        </section>

        <footer style={{ marginTop: "3rem", paddingTop: "1.25rem", borderTop: "1px solid rgba(255,255,255,0.08)", color: "#64748b", fontSize: "0.85rem" }}>
          MyBotIA — Environnement de travail augmenté. Cette page n&rsquo;expose aucun secret ni token.
        </footer>
      </main>
    </div>
  );
}
