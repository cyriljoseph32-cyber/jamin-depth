import { taskCategories, ventures, type TaskCategory, type Venture } from "./types";

/**
 * À qui revient une tâche.
 *
 * Table écrite à la main, jamais devinée : un routage deviné se trompe en
 * silence — la tâche part chez un agent qui n'en fera rien et personne ne s'en
 * aperçoit avant l'échéance.
 *
 * Les noms sont ceux des agents qui **existent réellement** : les agents de ce
 * dépôt (`src/agents/roles/`) pour la plongée, et les fichiers
 * `.claude/agents/` des autres dépôts pour le reste. Une case sans titulaire
 * sort `UNASSIGNED` plutôt qu'un nom plausible.
 */

/** Ce qu'on écrit quand aucun agent réel ne couvre la case. */
export const UNASSIGNED = "[À COMPLÉTER PAR CYRIL]";

type Routes = Readonly<Partial<Record<TaskCategory, string>>> & { readonly default: string };

const ROUTING: Readonly<Record<Venture, Routes>> = {
  // Plongée : les agents vivent dans ce dépôt, `src/agents/roles/`.
  DIVING: {
    sales: "reception",
    support: "reception",
    content: "content",
    marketing: "content",
    partner: "ops",
    operations: "ops",
    default: "reception",
  },
  // Rugby : `.claude/agents/` de Coconut-Samui-Rugby-Academy.
  RUGBY: {
    sales: "communication",
    partner: "communication",
    content: "marketing",
    marketing: "marketing",
    operations: "secretariat",
    support: "secretariat",
    product: "webmaster",
    default: "assistant-cyril",
  },
  // Coco : le front desk (assistant-ai) et le concierge (coco2).
  COCO: {
    sales: "commercial-coco",
    partner: "partenariats-concierge",
    content: "growth-concierge",
    marketing: "growth-concierge",
    product: "dev-coco",
    operations: "qualite-coco",
    support: "qualite-coco",
    default: "dev-coco",
  },
  GLOBAL: {
    default: "coco-command",
  },
};

/**
 * L'agent d'une case. `finance` n'a de titulaire nulle part : aucun agent de
 * Cyril ne touche à l'argent, et en inventer un ici reviendrait à router des
 * décisions financières vers le vide.
 */
export function agentFor(venture: Venture, category: TaskCategory): string {
  if (category === "finance") return UNASSIGNED;
  const routes = ROUTING[venture];
  return routes[category] ?? routes.default;
}

/**
 * Les rôles nommés dans le mandat, vers ce qui existe.
 *
 * Le mandat décrit une organisation cible (`growth_director`,
 * `diving_sales_agent`, `sales_crm_agent`…). Créer seize fichiers d'agents pour
 * la faire correspondre dupliquerait l'équipe réelle de Cyril. Ces alias
 * traduisent, ce qui laisse le mandat lisible sans rien dédoubler.
 *
 * Un rôle sans `venture` est transverse : la venture vient alors de la tâche.
 */
export const SPEC_ROLES: Readonly<
  Record<string, { readonly venture?: Venture; readonly category: TaskCategory }>
> = {
  // Rôles centraux — transverses.
  chief_of_staff: { venture: "GLOBAL", category: "operations" },
  growth_director: { category: "marketing" },
  sales_crm_agent: { category: "sales" },
  partner_agent: { category: "partner" },
  finance_watch_agent: { category: "finance" },
  operations_agent: { category: "operations" },
  content_director: { category: "content" },
  reputation_agent: { category: "support" },

  // Rôles métier — la venture est déjà dans le nom.
  coco_concierge_agent: { venture: "COCO", category: "support" },
  coco_partner_agent: { venture: "COCO", category: "partner" },
  diving_sales_agent: { venture: "DIVING", category: "sales" },
  diving_content_agent: { venture: "DIVING", category: "content" },
  rugby_admin_agent: { venture: "RUGBY", category: "operations" },
  rugby_growth_agent: { venture: "RUGBY", category: "marketing" },
};

export function isSpecRole(value: string): boolean {
  return Object.hasOwn(SPEC_ROLES, value.toLowerCase());
}

/**
 * Résout un rôle du mandat vers un agent réel.
 *
 * `fallback` sert aux rôles transverses, qui n'ont de sens qu'appliqués à une
 * activité précise.
 */
export function resolveSpecRole(role: string, fallback: Venture = "GLOBAL"): {
  venture: Venture;
  category: TaskCategory;
  agent: string;
} | null {
  const spec = SPEC_ROLES[role.toLowerCase()];
  if (!spec) return null;
  const venture = spec.venture ?? fallback;
  return { venture, category: spec.category, agent: agentFor(venture, spec.category) };
}

/**
 * Devine la catégorie d'une tâche écrite en langage courant.
 *
 * Un filet, pas une intelligence : `/delegate RUGBY relancer les écoles` doit
 * partir chez quelqu'un plutôt que d'exiger une taxonomie de la part de Cyril
 * un dimanche soir. En cas de doute, `operations` — le titulaire y est toujours
 * celui qui saura rediriger.
 */
const CATEGORY_HINTS: readonly { match: RegExp; category: TaskCategory }[] = [
  { match: /relanc|lead|devis|client|vente|prospect|réserv|reserv|inscri/i, category: "sales" },
  { match: /partenaire|sponsor|hôtel|hotel|agence|école|ecole/i, category: "partner" },
  { match: /post|reel|instagram|contenu|article|seo|blog|photo/i, category: "content" },
  { match: /campagne|pub|marketing|visibilité|visibilite|audience/i, category: "marketing" },
  { match: /facture|paiement|rembours|budget|prix|tarif|compta/i, category: "finance" },
  { match: /site|bug|déploie|deploie|code|api|technique/i, category: "product" },
  { match: /avis|plainte|réclamation|reclamation|support/i, category: "support" },
  // Le cas le plus fréquent : quelqu'un a écrit et attend une réponse.
  { match: /répond|repond|demande|question|message|appel|contact/i, category: "support" },
];

export function guessCategory(text: string): TaskCategory {
  for (const { match, category } of CATEGORY_HINTS) {
    if (match.test(text)) return category;
  }
  return "operations";
}

/** Toutes les cases, pour les tests et la documentation. */
export function routingTable(): { venture: Venture; category: TaskCategory; agent: string }[] {
  return ventures.flatMap((venture) =>
    taskCategories.map((category) => ({ venture, category, agent: agentFor(venture, category) })),
  );
}
