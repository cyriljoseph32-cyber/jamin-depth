import type { CommandEvent, Venture } from "./types";

/**
 * Les hashtags Telegram.
 *
 * Ils restent utiles même avec quatre chats séparés : une recherche sur
 * `#URGENT` traverse toutes les conversations, et un repli sur un chat unique
 * (aucune variable `TELEGRAM_CHAT_*` configurée) redevient lisible.
 */

const VENTURE_TAG: Readonly<Record<Venture, string>> = {
  COCO: "#COCO",
  DIVING: "#DIVING",
  RUGBY: "#RUGBY",
  GLOBAL: "#GLOBAL",
};

/** Agents dont le travail relève d'un domaine transverse — un tag de plus. */
const DOMAIN_TAG: readonly { match: RegExp; tag: string }[] = [
  { match: /market|content|contenu|growth|social/i, tag: "#MARKETING" },
  { match: /commercial|sales|vente|partenariat|sponsor|reception|booking/i, tag: "#SALES" },
  { match: /ops|admin|memory|secretariat|finance|compta/i, tag: "#ADMIN" },
];

export function tagsFor(event: Pick<CommandEvent, "venture" | "agent" | "priority" | "type">): string {
  const tags = [VENTURE_TAG[event.venture]];
  for (const { match, tag } of DOMAIN_TAG) {
    if (match.test(event.agent) && !tags.includes(tag)) tags.push(tag);
  }
  if (event.priority === "P0" || event.type === "ERROR") tags.push("#URGENT");
  return ["#COCO_COMMAND", ...tags].join(" ");
}

/** Le tag d'agent seul, pour l'en-tête `[✅ ACTION] #VENTURE #AGENT`. */
export function agentTag(agent: string): string {
  return `#${agent.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
}
