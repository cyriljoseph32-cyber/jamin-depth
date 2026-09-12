import type { Channel, Contact } from "@/agents/types";
import { channels } from "@/agents/types";
import { contactKey } from "@/agents/adapters";
import type { CommandEventInput, Venture } from "./types";

/**
 * Le maillon qui manquait au chantier 2.
 *
 * coco2 et CSRA poussaient déjà leurs leads dans `/api/command/events`, mais un
 * événement est une *trace d'activité*, pas une *personne* : la table `leads`
 * est restée à 0 ligne pendant que le journal en accumulait 104. Résultat, la
 * question « combien de personnes nous ont contactés ? » n'avait aucune réponse,
 * et la même personne écrivant sur WhatsApp puis via le formulaire comptait deux
 * fois — ou zéro.
 *
 * Ce module dérive une identité depuis un événement entrant. La déduplication
 * n'est pas réinventée : c'est `contactKey()` de `src/agents/adapters`, déjà
 * testée et déjà utilisée par les agents plongée (téléphone normalisé → e-mail →
 * pseudo → nom). Une seule règle de fusion dans tout le système.
 */

export interface PersonSeed {
  /** La clé de déduplication — une personne, une ligne. */
  key: string;
  contact: Contact;
  channel: Channel;
  venture: Venture;
  source?: string;
}

/** Les canaux qu'un projet tiers a le droit de déclarer. */
function asChannel(value: unknown): Channel | null {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (channels as readonly string[]).includes(v) ? (v as Channel) : null;
}

function clean(value: unknown, max = 200): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim().slice(0, max);
  return v.length > 0 ? v : undefined;
}

/**
 * Le filet pour les émetteurs déjà déployés.
 *
 * coco2 et CSRA sont en production et écrivent leurs coordonnées dans `details`,
 * sous la forme `nom=… email=… tel=…`. Plutôt que d'attendre qu'ils soient tous
 * redéployés pour commencer à constituer la base, on relit ce format — qu'ils
 * ont en commun parce qu'ils ont été écrits ensemble.
 *
 * Volontairement strict : on ne devine pas un e-mail au milieu d'une phrase, on
 * ne lit qu'un champ explicitement étiqueté. Un faux positif créerait une fiche
 * fantôme, ce qui est pire qu'une fiche manquante.
 */
export function contactFromDetails(details: string): Contact {
  const contact: Contact = {};
  const field = (labels: string[]): string | undefined => {
    for (const label of labels) {
      // `label=valeur`. Les deux émetteurs en production n'utilisent pas le
      // même séparateur — CSRA écrit ` · `, coco2 se contente d'une espace — et
      // une valeur peut elle-même contenir des espaces (« Kelsey Family »). La
      // valeur s'arrête donc au prochain `mot=`, au ` · `, ou à la fin.
      const m = new RegExp(`(?:^|[\\s·])${label}=(.*?)(?=\\s+[\\w-]+=|\\s*·|$)`, "i").exec(details);
      const value = m?.[1]?.trim();
      if (value && value !== "N/A" && value !== "-") return value.slice(0, 200);
    }
    return undefined;
  };
  const email = field(["email", "mail"]);
  if (email && email.includes("@")) contact.email = email.toLowerCase();
  const phone = field(["tel", "phone", "telephone", "whatsapp"]);
  if (phone && phone.replace(/\D/g, "").length >= 8) contact.phone = phone;
  const name = field(["nom", "name"]);
  if (name) contact.name = name;
  const handle = field(["handle", "ig", "instagram"]);
  if (handle) contact.handle = handle;
  return contact;
}

/**
 * Extrait la personne d'un événement, ou `null` s'il n'en porte pas.
 *
 * La plupart des événements (un cron qui tourne, un contenu publié) ne
 * concernent personne : ils ne doivent créer aucune fiche. On n'accepte donc
 * que les événements portant une coordonnée réellement identifiante — un nom
 * seul ne suffit pas, « Marie » n'est pas une identité.
 */
export function personFromEvent(event: CommandEventInput): PersonSeed | null {
  const raw = event as CommandEventInput & { contact?: unknown; channel?: unknown; source?: unknown };

  // 1. Le contrat structuré, quand l'émetteur est à jour.
  let contact: Contact = {};
  if (typeof raw.contact === "object" && raw.contact !== null) {
    const c = raw.contact as Record<string, unknown>;
    const email = clean(c.email, 160)?.toLowerCase();
    if (email && email.includes("@")) contact.email = email;
    const phone = clean(c.phone, 40);
    if (phone && phone.replace(/\D/g, "").length >= 8) contact.phone = phone;
    contact.name = clean(c.name, 120);
    contact.handle = clean(c.handle, 80)?.toLowerCase();
  }

  // 2. Le filet, pour les émetteurs pas encore redéployés.
  if (!contact.email && !contact.phone && !contact.handle) {
    const parsed = contactFromDetails(event.details ?? "");
    contact = { ...parsed, ...Object.fromEntries(Object.entries(contact).filter(([, v]) => v !== undefined)) };
  }

  // Sans coordonnée identifiante, pas de fiche. Un nom seul produirait une clé
  // `name:<canal>:<nom>` qui fusionnerait deux homonymes — pire que rien.
  if (!contact.email && !contact.phone && !contact.handle) return null;

  const channel = asChannel(raw.channel) ?? defaultChannel(event);
  return {
    key: contactKey(contact, channel),
    contact,
    channel,
    venture: event.venture,
    source: clean(raw.source, 60) ?? event.agent,
  };
}

/**
 * Faute de canal déclaré, on déduit le plus probable depuis l'agent émetteur.
 * `site_form` est le défaut : c'est le seul canal dont on est sûr qu'il a pu
 * produire une coordonnée complète sans conversation préalable.
 */
function defaultChannel(event: CommandEventInput): Channel {
  const agent = (event.agent ?? "").toLowerCase();
  if (agent.includes("whatsapp")) return "whatsapp";
  if (agent.includes("instagram") || agent.includes("ig-")) return "instagram";
  if (agent.includes("chat")) return "site_chat";
  if (agent.includes("mail")) return "email";
  return "site_form";
}
