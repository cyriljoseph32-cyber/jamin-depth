import type { Contact } from "./types";

/**
 * Reconnaître un refus, et s'en souvenir pour toujours.
 *
 * Le risque R1 de l'audit n'est pas théorique : Samui Pro Nutrition a refusé le
 * 09/08 et a été relancé le 11/08, puis le 24/08. Le code avait pourtant la
 * bonne garde — `dueFollowUps()` ignore les leads au stade `lost`. Elle était
 * simplement inatteignable : `setStage()` existait sans qu'aucun appelant ne
 * l'utilise jamais. Une garde que personne ne déclenche ne protège de rien.
 *
 * Ce module ferme le circuit : détecter le refus dans le message, puis le rendre
 * indélébile.
 */

/**
 * Les formulations qui valent refus, en français, anglais et thaï.
 *
 * Choix assumé : on vise le refus NET, pas l'hésitation. « je vais réfléchir »
 * ou « pas maintenant » n'entrent pas ici — ce sont des leads tièdes, qu'une
 * relance sert justement. Se tromper dans ce sens coûte une relance de trop ;
 * se tromper dans l'autre coûte une porte définitivement fermée, ce qui est
 * bien plus cher. En cas de doute, le message part en validation humaine.
 */
const REFUSAL_PATTERNS: readonly RegExp[] = [
  // Français
  /\bpas intéress[ée]/i,
  /\bça ne (?:m|nous) intéresse pas/i,
  /\bne (?:me|nous) recontactez plus/i,
  /\bne (?:plus|pas) (?:me|nous) (?:contacter|écrire|relancer)/i,
  /\bmerci de (?:ne plus|cesser)/i,
  /\bd[ée]sabonne/i,
  /\bretirez[- ](?:moi|nous)/i,
  /\bon (?:ne )?donne(?:ra)? pas suite/i,
  /\bsans suite\b/i,
  /\bnon merci\b/i,
  // Anglais
  /\bnot interested\b/i,
  /\bno longer interested\b/i,
  /\b(?:please )?(?:stop|do ?n[o']?t) (?:contact|email|messag|writ|reach)/i,
  /\bremove me\b/i,
  /\bunsubscribe\b/i,
  /\btake me off\b/i,
  /\bnot a (?:good )?fit\b/i,
  /\bwe(?:'ll| will) pass\b/i,
  // Thaï — « pas intéressé », « ne plus contacter »
  /ไม่สนใจ/,
  /อย่าติดต่อ/u,
  /หยุดส่ง/u,
];

export interface RefusalVerdict {
  refused: boolean;
  /** La formulation reconnue, pour que la décision soit auditable. */
  matched?: string;
}

/**
 * Le message exprime-t-il un refus ?
 *
 * Ne juge que le texte fourni. Un refus rapporté par un tiers (« il m'a dit
 * qu'il n'était pas intéressé ») doit passer par une décision humaine, pas par
 * cette fonction : on ne ferme pas une porte sur un ouï-dire.
 */
export function detectRefusal(message: string): RefusalVerdict {
  const text = (message ?? "").trim();
  if (text.length === 0) return { refused: false };
  for (const re of REFUSAL_PATTERNS) {
    const m = re.exec(text);
    if (m) return { refused: true, matched: m[0] };
  }
  return { refused: false };
}

/**
 * Les stades dont on ne revient pas tout seul.
 *
 * `lost` est le refus, `won` est la conversion. Dans les deux cas, un simple
 * message entrant ne doit pas ramener la personne à `new` : seule une décision
 * explicite de Cyril rouvre un dossier fermé.
 */
export const TERMINAL_STAGES = new Set(["lost", "won"]);

/** Un refus est définitif tant qu'un humain ne le lève pas. */
export function isOptedOut(lead: { optedOut?: boolean; stage: string }): boolean {
  return lead.optedOut === true || lead.stage === "lost";
}

/** La note portée au dossier, pour que la raison survive au temps qui passe. */
export function refusalNote(verdict: RefusalVerdict, at: string, contact?: Contact): string {
  const who = contact?.name ? ` (${contact.name})` : "";
  return `[${at}] Refus enregistré${who} — « ${verdict.matched ?? "refus explicite"} ». Aucune relance, aucune approche, jamais, sauf décision explicite de Cyril.`;
}
