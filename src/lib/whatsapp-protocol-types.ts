// LEA-WA-PROTOCOLS-MVP-ADMIN — types partagés API/UI.

export const WA_PROTOCOL_CATEGORIES = [
  "support_client",
  "commercial_demo",
  "project_workgroup",
  "web_project_delivery",
  "payment_followup",
  "legal_workgroup",
  "sensitive_validation",
  "custom",
] as const;
export type WaProtocolCategory = (typeof WA_PROTOCOL_CATEGORIES)[number];

export const WA_PROTOCOL_RESPONSE_MODES = [
  "draft_only",
  "auto_safe",
  "operational_autonomous",
  "silent",
  "disabled",
] as const;
export type WaProtocolResponseMode = (typeof WA_PROTOCOL_RESPONSE_MODES)[number];

export const WA_PROTOCOL_GILLES_INSTRUCTION_MODES = [
  "draft_before_send",
  "send_if_explicit_go",
  "send_direct_if_gilles_writes_exact_message",
] as const;
export type WaProtocolGillesInstructionMode = (typeof WA_PROTOCOL_GILLES_INSTRUCTION_MODES)[number];

export const WA_PROTOCOL_STATUSES = ["active", "disabled"] as const;
export type WaProtocolStatus = (typeof WA_PROTOCOL_STATUSES)[number];

export const WA_CATEGORY_LABEL: Record<WaProtocolCategory, string> = {
  support_client: "support client",
  commercial_demo: "commercial / démo",
  project_workgroup: "projet / groupe de travail",
  web_project_delivery: "projet web / livraison",
  payment_followup: "relance paiement",
  legal_workgroup: "groupe avocats / juridique",
  sensitive_validation: "validation sensible",
  custom: "custom",
};

export const WA_CATEGORY_HELP: Record<WaProtocolCategory, string> = {
  support_client: "Support technique / opérationnel pour un client (accès, contenu, bugs simples).",
  commercial_demo: "Démonstration MyBotIA, échange commercial, démo produit.",
  project_workgroup: "Groupe projet interne ou mixte. Coordination, livrables, suivi.",
  web_project_delivery: "Livraison projet web : cahier des charges, contenu, mise en ligne, GitHub/Vercel si autorisé par le périmètre.",
  payment_followup: "Relance paiement. Brouillon obligatoire sauf GO explicite ou texte exact fourni par Gilles.",
  legal_workgroup: "Coordination avec avocat·e·s ou cabinet juridique. Aucun conseil juridique ferme sans Gilles.",
  sensitive_validation: "Sujet sensible (contractuel, sécurité, RGPD, finance). Toujours brouillon Gilles.",
  custom: "Catégorie libre. Définir le périmètre dans operational_scope + protocol_text.",
};

export const WA_RESPONSE_MODE_LABEL: Record<WaProtocolResponseMode, string> = {
  draft_only: "brouillon uniquement",
  auto_safe: "auto sûr",
  operational_autonomous: "opérationnel autonome",
  silent: "silencieux",
  disabled: "désactivé",
};

export const WA_RESPONSE_MODE_HELP: Record<WaProtocolResponseMode, string> = {
  draft_only: "Léa rédige un brouillon pour Gilles, n'envoie rien.",
  auto_safe: "Léa envoie si la réponse est sûre selon le protocole.",
  operational_autonomous:
    "Léa peut exécuter les actions opérationnelles autorisées dans le protocole. Elle ne décide jamais des prix, devis, délais fermes ou engagements.",
  silent: "Léa ne répond pas, mais Gilles voit le message côté privé.",
  disabled: "Léa ne traite pas du tout ce groupe.",
};

export const WA_GILLES_MODE_LABEL: Record<WaProtocolGillesInstructionMode, string> = {
  draft_before_send: "brouillon avant envoi",
  send_if_explicit_go: "envoi sur GO explicite",
  send_direct_if_gilles_writes_exact_message: "envoi direct si Gilles écrit le texte exact",
};

export const WA_STATUS_LABEL: Record<WaProtocolStatus, string> = {
  active: "actif",
  disabled: "désactivé",
};

export interface WhatsappProtocol {
  id: string;
  jid: string;
  groupName: string;
  tenantSlug: string;
  agentSlug: string;
  category: WaProtocolCategory;
  responseMode: WaProtocolResponseMode;
  gillesInstructionMode: WaProtocolGillesInstructionMode;
  status: WaProtocolStatus;
  operationalScope: string;
  protocolText: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
