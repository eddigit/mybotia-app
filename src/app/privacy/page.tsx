import Image from "next/image";

const LOGO_URL =
  "https://res.cloudinary.com/dniurvpzd/image/upload/q_auto/f_auto/v1772032713/Logo_Collaborateur_IA_coujhr.svg";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-surface-0 bg-gradient-hero text-text-primary px-4 py-16 overflow-y-auto">
      <div className="max-w-3xl mx-auto">
        <header className="flex items-center gap-4 mb-12">
          <Image
            src={LOGO_URL}
            alt="MyBotIA"
            width={48}
            height={48}
            className="w-12 h-12 object-contain"
            unoptimized
          />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Confidentialité — MyBotIA</h1>
            <p className="text-sm text-text-secondary">Dernière mise à jour&nbsp;: 7 mai 2026</p>
          </div>
        </header>

        <section className="space-y-6 text-sm leading-relaxed">
          <p>
            MyBotIA, exploitée par Gilles Korzec (G. Korzec EI), conçoit et opère des collaborateurs IA
            professionnels pour ses clients. La présente page décrit les principes de confidentialité
            qui s&apos;appliquent à l&apos;écosystème MyBotIA et, en particulier, aux <em>Actions</em> GPT
            sécurisées qui permettent à Gilles d&apos;interagir avec son environnement professionnel
            depuis ChatGPT.
          </p>

          <h2 className="text-lg font-semibold mt-10">1. Quelles données sont traitées</h2>
          <p>
            Les Actions GPT MyBotIA peuvent transmettre&nbsp;: les requêtes formulées par
            l&apos;utilisateur, des résumés CRM strictement nécessaires à la demande, des tâches en cours,
            des brouillons d&apos;email ou de message préparés à la demande, et des contextes
            documentaires explicitement sollicités. Les données sont systématiquement
            <strong> minimisées</strong>&nbsp;: l&apos;API ne renvoie que ce qui est nécessaire à la réponse,
            avec un niveau de granularité contrôlable.
          </p>

          <h2 className="text-lg font-semibold mt-10">2. Ce qui n&apos;est jamais transmis</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Aucun secret, jeton, mot de passe ou clé API.</li>
            <li>Aucune copie brute de fichiers d&apos;environnement.</li>
            <li>Aucune donnée d&apos;un autre client que celle de l&apos;utilisateur appelant.</li>
            <li>Aucun contenu d&apos;infrastructure technique sensible.</li>
          </ul>

          <h2 className="text-lg font-semibold mt-10">3. Source de vérité</h2>
          <p>
            Les données métier (CRM, mémoire, documents, agenda, brouillons persistants) restent
            dans l&apos;infrastructure MyBotIA. ChatGPT n&apos;est pas utilisé comme base de données de
            référence&nbsp;: il sert d&apos;interface conversationnelle. Les Actions appellent en arrière-plan
            les services internes MyBotIA, qui demeurent les sources de vérité.
          </p>

          <h2 className="text-lg font-semibold mt-10">4. Aucun envoi automatique</h2>
          <p>
            Les Actions GPT MyBotIA ne déclenchent <strong>jamais</strong> automatiquement un envoi
            d&apos;email, de message WhatsApp, d&apos;invitation calendrier ou tout message externe.
            Tout message à un tiers reste un brouillon que l&apos;utilisateur valide manuellement.
          </p>

          <h2 className="text-lg font-semibold mt-10">5. Pas de vente, pas de partage</h2>
          <p>
            Les données traitées via les Actions MyBotIA ne sont ni vendues, ni cédées, ni partagées
            avec un tiers commercial. Les seuls flux sortants sont&nbsp;: la réponse retournée à
            l&apos;utilisateur dans son interface ChatGPT, et les appels nécessaires à OpenAI pour le
            fonctionnement même de la conversation.
          </p>

          <h2 className="text-lg font-semibold mt-10">6. Usage personnel et professionnel</h2>
          <p>
            Le GPT « Léa — MyBotIA » et les Actions associées sont conçus pour un usage personnel et
            professionnel contrôlé par Gilles Korzec. Il ne s&apos;agit pas d&apos;un service public ouvert.
          </p>

          <h2 className="text-lg font-semibold mt-10">7. Sécurité</h2>
          <p>
            Les Actions MyBotIA sont protégées par authentification (jeton de service), par verrouillage
            de tenant et d&apos;agent, et par des politiques d&apos;accès qui interdisent toute modification
            sensible sans validation explicite. Le détail technique reste interne et n&apos;est pas
            communiqué à des tiers.
          </p>

          <h2 className="text-lg font-semibold mt-10">8. Conservation</h2>
          <p>
            Les données métier restent gouvernées par les politiques de rétention propres à chaque
            système d&apos;origine (CRM, base de connaissances, workspace agent). Les Actions GPT
            n&apos;introduisent pas de stockage parallèle&nbsp;: ce qui est stocké l&apos;est dans l&apos;infrastructure
            MyBotIA, conformément aux politiques en vigueur.
          </p>

          <h2 className="text-lg font-semibold mt-10">9. Vos droits</h2>
          <p>
            Pour toute demande d&apos;accès, de rectification ou de suppression d&apos;informations vous
            concernant et présentes dans l&apos;infrastructure MyBotIA, écrivez à&nbsp;:
            <br />
            <a className="text-accent hover:underline" href="mailto:gilleskorzec@gmail.com">
              gilleskorzec@gmail.com
            </a>
          </p>

          <h2 className="text-lg font-semibold mt-10">10. Contact</h2>
          <p>
            <strong>MyBotIA</strong> — Gilles Korzec (G. Korzec EI)
            <br />
            <a className="text-accent hover:underline" href="mailto:gilleskorzec@gmail.com">
              gilleskorzec@gmail.com
            </a>
          </p>
        </section>

        <footer className="mt-16 pt-6 border-t border-border-default text-xs text-text-secondary">
          MyBotIA — Environnement de travail augmenté.
        </footer>
      </div>
    </div>
  );
}
