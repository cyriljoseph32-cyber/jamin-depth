import { DIVE_CENTER } from "@/content/site";
import type { Activity } from "./types";
import { TODO, type Verified, verified } from "./config";

/**
 * The offer catalogue — the only prices any agent may quote.
 *
 * Figures are the ones already published on the site (see the diving pages and
 * the assistant prompt in `src/lib/assistant.ts`), which came from Discovery
 * Divers' own public pricing. Anything not listed is `TODO`, and an agent asked
 * about it says the diver handles it directly rather than guessing.
 *
 * All prices are per person, in THB, and subject to change — `PRICE_CAVEAT`
 * carries that sentence so no template can forget it.
 */

export interface Offer {
  id: string;
  activity: Activity;
  /** Customer-facing name, per locale. */
  name: { fr: string; en: string };
  /** THB per person, or TODO when unconfirmed. */
  fromPriceTHB: Verified<number>;
  duration: { fr: string; en: string } | null;
  /** Certification required to join. */
  requiresCertification: boolean;
  /** True when the site already states equipment is included. */
  equipmentIncluded: boolean;
  /** Where the figure comes from — auditable. */
  source: string;
}

const PARTNER_SOURCE = `${DIVE_CENTER.name} public pricing (as published on the site)`;

export const OFFERS: readonly Offer[] = [
  {
    id: "discover_scuba",
    activity: "discover_scuba",
    name: { fr: "Baptême de plongée (Discover Scuba Diving)", en: "Discover Scuba Diving" },
    fromPriceTHB: 5850,
    duration: { fr: "1 journée", en: "1 day" },
    requiresCertification: false,
    equipmentIncluded: true,
    source: PARTNER_SOURCE,
  },
  {
    id: "open_water",
    activity: "course",
    name: { fr: "PADI Open Water Diver", en: "PADI Open Water Diver" },
    fromPriceTHB: 17900,
    duration: { fr: "3 à 4 jours", en: "3–4 days" },
    requiresCertification: false,
    equipmentIncluded: true,
    source: PARTNER_SOURCE,
  },
  {
    id: "advanced_open_water",
    activity: "course",
    name: { fr: "PADI Advanced Open Water", en: "PADI Advanced Open Water" },
    fromPriceTHB: 13900,
    duration: { fr: "2 jours, 5 plongées d'aventure", en: "2 days, 5 adventure dives" },
    requiresCertification: true,
    equipmentIncluded: true,
    source: PARTNER_SOURCE,
  },
  {
    id: "specialty_course",
    activity: "course",
    name: { fr: "Spécialités PADI", en: "PADI specialty courses" },
    fromPriceTHB: TODO,
    duration: null,
    requiresCertification: true,
    equipmentIncluded: true,
    source: "Price on request — not published.",
  },
  {
    id: "sail_rock",
    activity: "certified_fun_dive",
    name: { fr: "Sortie Sail Rock", en: "Sail Rock day trip" },
    fromPriceTHB: 4550,
    duration: null,
    requiresCertification: true,
    equipmentIncluded: true,
    source: PARTNER_SOURCE,
  },
  {
    id: "koh_tao",
    activity: "certified_fun_dive",
    name: { fr: "Sortie Koh Tao (2 plongées)", en: "Koh Tao day trip (2 dives)" },
    fromPriceTHB: 4850,
    duration: null,
    requiresCertification: true,
    equipmentIncluded: true,
    source: PARTNER_SOURCE,
  },
  {
    id: "chumphon_pinnacle",
    activity: "certified_fun_dive",
    name: { fr: "Chumphon Pinnacle", en: "Chumphon Pinnacle" },
    fromPriceTHB: 5050,
    duration: null,
    requiresCertification: true,
    equipmentIncluded: true,
    source: PARTNER_SOURCE,
  },
  {
    id: "snorkeling",
    activity: "snorkeling",
    name: { fr: "Snorkeling", en: "Snorkelling" },
    fromPriceTHB: 2450,
    duration: null,
    requiresCertification: false,
    equipmentIncluded: true,
    source: PARTNER_SOURCE,
  },
  {
    id: "private_group",
    activity: "other",
    name: { fr: "Groupe privé / sortie privatisée", en: "Private group / private charter" },
    fromPriceTHB: TODO,
    duration: null,
    requiresCertification: false,
    equipmentIncluded: false,
    source: "Not published — owner to confirm.",
  },
  {
    id: "recovery",
    activity: "recovery",
    name: { fr: "Récupération sous-marine", en: "Underwater recovery" },
    fromPriceTHB: TODO,
    duration: null,
    requiresCertification: false,
    equipmentIncluded: false,
    source: "Quoted case by case after assessment — never priced by an agent.",
  },
];

export function findOffer(id: string): Offer | undefined {
  return OFFERS.find((o) => o.id === id);
}

/** Offers matching an activity, cheapest confirmed price first. */
export function offersFor(activity: Activity): Offer[] {
  return OFFERS.filter((o) => o.activity === activity).sort((a, b) => {
    const pa = verified(a.fromPriceTHB) ?? Number.MAX_SAFE_INTEGER;
    const pb = verified(b.fromPriceTHB) ?? Number.MAX_SAFE_INTEGER;
    return pa - pb;
  });
}

/** Every price an agent is allowed to write down. Used by the draft guard. */
export function quotablePrices(): number[] {
  return OFFERS.map((o) => verified(o.fromPriceTHB)).filter((p): p is number => p !== null);
}

/** `฿5,850` — the format already used across the site. */
export function formatTHB(amount: number): string {
  return `฿${amount.toLocaleString("en-US")}`;
}

export const PRICE_CAVEAT = {
  fr: "Tarif par personne, susceptible d'évoluer et confirmé à la réservation.",
  en: "Per-person price, subject to change and confirmed at booking.",
} as const;
