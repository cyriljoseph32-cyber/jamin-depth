import type { Locale } from "@/content/i18n";

/**
 * Approved message blocks, FR + EN.
 *
 * Design rules, all enforced by `render()`:
 *  - Every variable is a named slot. A slot that is missing or empty makes the
 *    template REFUSE to render — it never degrades into "à partir de {price}"
 *    or, worse, into a confident sentence with a hole quietly closed.
 *  - Blocks are composable and short. The agent assembles two or three of them
 *    (acknowledgement + missing info + handoff) instead of one giant template
 *    with optional halves.
 *  - Tone matches the site: direct, reassuring, concrete, no emoji, no
 *    markdown headings, 2–5 sentences.
 *  - Nothing in here promises a seat, the weather, wildlife, a response time,
 *    or fitness to dive. `policy.auditDraft()` re-checks every rendered body,
 *    including these — a template is not trusted just because it is approved.
 */

export interface Template {
  id: string;
  body: Record<Locale, string>;
}

const t = (id: string, fr: string, en: string): Template => ({ id, body: { fr, en } });

export const TEMPLATES: readonly Template[] = [
  /* ---------------- Reception: first reply per activity ---------------- */
  t(
    "lead.ack.discover_scuba",
    "Bonjour {name}, merci pour votre message. Le baptême Discover Scuba Diving est fait exactement pour ça : vos premières respirations sous l'eau, encadrées, sur une journée, sans expérience ni brevet requis — à partir de {price}, matériel de plongée inclus. {caveat}",
    "Hello {name}, thanks for reaching out. Discover Scuba Diving is exactly that: your first breaths underwater, guided, over one day, with no experience or certification needed — from {price}, dive equipment included. {caveat}",
  ),
  t(
    "lead.ack.certified_fun_dive",
    "Bonjour {name}, merci pour votre message. Pour des plongées d'exploration, les sorties partent vers Sail Rock, Koh Tao et Chumphon Pinnacle, avec {partner} — à partir de {price} par personne. {caveat}",
    "Hello {name}, thanks for reaching out. For fun dives, trips run to Sail Rock, Koh Tao and Chumphon Pinnacle with {partner} — from {price} per person. {caveat}",
  ),
  t(
    "lead.ack.course",
    "Bonjour {name}, merci pour votre message. Les formations PADI se font avec {partner}, où le plongeur derrière Jammin's Depths est instructeur — l'Open Water à partir de {price}, matériel inclus. {caveat}",
    "Hello {name}, thanks for reaching out. PADI courses run with {partner}, where the diver behind Jammin's Depths is an instructor — Open Water from {price}, equipment included. {caveat}",
  ),
  t(
    "lead.ack.snorkeling",
    "Bonjour {name}, merci pour votre message. Le snorkeling se fait sur tous les sites de sortie, à partir de {price} par personne. {caveat}",
    "Hello {name}, thanks for reaching out. Snorkelling runs at every trip site, from {price} per person. {caveat}",
  ),
  t(
    "lead.ack.recovery",
    "Bonjour {name}, merci de nous avoir écrit. Pour une recherche sous l'eau, le plus utile tout de suite est l'objet exact, l'endroit précis et l'heure de la perte — plus c'est précis, meilleures sont les chances. On regarde la faisabilité, la sécurité et l'accès avant de s'engager, et vous saurez honnêtement ce qui est réaliste.",
    "Hello {name}, thanks for writing. For an underwater search, the most useful things right now are the exact object, the precise spot and the time it went in — the more precise, the better the odds. We look at feasibility, safety and access before committing, and you will get an honest answer on what is realistic.",
  ),
  t(
    "lead.ack.generic",
    "Bonjour {name}, merci pour votre message. On peut vous orienter vers un baptême, une sortie pour plongeurs certifiés, une formation ou du snorkeling autour de Koh Samui.",
    "Hello {name}, thanks for your message. We can point you to a first dive, a trip for certified divers, a course, or snorkelling around Koh Samui.",
  ),

  /* ---------------- Reception: qualification & follow-up ---------------- */
  t(
    "lead.missing_info",
    "Pour préparer ça correctement, il me manque juste : {questions}",
    "To set this up properly, I just need: {questions}",
  ),
  t(
    "lead.followup.1",
    "Bonjour {name}, je reviens vers vous au sujet de votre demande de plongée à Koh Samui. Si vos dates se précisent, dites-le-moi et on prépare la sortie.",
    "Hello {name}, following up on your diving enquiry for Koh Samui. If your dates firm up, let me know and we'll get it set up.",
  ),
  t(
    "lead.followup.2",
    "Bonjour {name}, dernier message de ma part pour ne pas vous encombrer. La porte reste ouverte : écrivez quand vous voulez, même à la dernière minute.",
    "Hello {name}, last note from me so I don't clutter your inbox. The door stays open — write whenever you like, even last minute.",
  ),

  /* ---------------- Booking ---------------- */
  t(
    "booking.recap_pending",
    "Voici le récapitulatif de votre demande, {name} :\n{recap}\n\nLa place n'est pas encore acquise : les disponibilités sont détenues par {partner}, on fait la demande et on revient vers vous avec leur réponse.",
    "Here's the summary of your request, {name}:\n{recap}\n\nThe place isn't held yet: availability sits with {partner}. We're asking them and will come back to you with their answer.",
  ),
  t(
    "booking.partner_request",
    "Demande de disponibilité pour {partner} :\n{recap}\n\nMerci de confirmer la place, l'horaire et le point de rendez-vous.",
    "Availability request for {partner}:\n{recap}\n\nPlease confirm the place, the schedule and the meeting point.",
  ),

  /* ---------------- Safety & preparation ---------------- */
  t(
    "safety.prearrival",
    "Bonjour {name}, quelques repères avant {date} : {details}\n\nSi quelque chose change de votre côté, dites-le-nous au plus tôt.",
    "Hello {name}, a few pointers before {date}: {details}\n\nIf anything changes on your side, tell us as early as you can.",
  ),
  t(
    "safety.sensitive_ack",
    "Merci de nous l'avoir signalé, {name} — c'est exactement le genre de chose qu'il faut dire avant de plonger, et ça se règle presque toujours. Ce point est médical : il est transmis au plongeur, qui vous répondra personnellement. Rien n'est réservé ni engagé d'ici là.",
    "Thanks for telling us, {name} — this is exactly the kind of thing to raise before diving, and it can almost always be sorted out. This one is medical: it goes to the diver, who will answer you personally. Nothing is booked or committed in the meantime.",
  ),
  t(
    "safety.documents_reminder",
    "Bonjour {name}, il reste des documents à fournir avant {date} : {documents}. Vous pouvez les envoyer ici, en photo.",
    "Hello {name}, some documents are still needed before {date}: {documents}. You can send them here as photos.",
  ),

  /* ---------------- Handoffs ---------------- */
  t(
    "handoff.human",
    "Bonjour {name}, votre message demande une réponse du plongeur lui-même — il vous répond directement. Vous pouvez aussi le joindre sur WhatsApp : {whatsapp}",
    "Hello {name}, your message needs an answer from the diver himself — he'll reply directly. You can also reach him on WhatsApp: {whatsapp}",
  ),
  t(
    "handoff.unverified_fact",
    "Bonjour {name}, sur ce point précis je ne veux pas vous donner une information approximative : le plongeur vous confirme ça directement. Voici son WhatsApp : {whatsapp}",
    "Hello {name}, on that specific point I'd rather not give you a rough answer: the diver will confirm it directly. Here's his WhatsApp: {whatsapp}",
  ),

  /* ---------------- Reputation ---------------- */
  t(
    "reputation.thanks",
    "Merci {name} pour ce retour, ça compte beaucoup pour une petite structure. Au plaisir de replonger avec vous à Koh Samui.",
    "Thank you {name} for this review — it means a lot to a small operation. Looking forward to diving with you again in Koh Samui.",
  ),
  t(
    "reputation.negative_draft",
    "Merci {name} d'avoir pris le temps de nous écrire, et désolé que l'expérience n'ait pas été à la hauteur. On aimerait comprendre précisément ce qui s'est passé : {contact}",
    "Thank you {name} for taking the time to write, and sorry the experience fell short. We'd like to understand exactly what happened: {contact}",
  ),

  /* ---------------- Internal ---------------- */
  t(
    "ops.daily_brief",
    "Brief opérationnel du {date}\n{lines}",
    "Operations brief for {date}\n{lines}",
  ),
];

const BY_ID: ReadonlyMap<string, Template> = new Map(TEMPLATES.map((tpl) => [tpl.id, tpl]));

const SLOT_RE = /\{(\w+)\}/g;

/** Slot names a template needs. Exported so agents can check before composing. */
export function slotsOf(id: string): string[] {
  const tpl = BY_ID.get(id);
  if (!tpl) return [];
  const names = new Set<string>();
  for (const locale of Object.keys(tpl.body) as Locale[]) {
    for (const m of tpl.body[locale].matchAll(SLOT_RE)) if (m[1]) names.add(m[1]);
  }
  return [...names];
}

export type RenderResult =
  | { ok: true; templateId: string; body: string }
  | { ok: false; templateId: string; missing: string[] };

/**
 * Fill a template. Refuses on any unknown template or unfilled slot — the
 * caller then records a gap and hands off, which is the whole point: a hole in
 * the data must surface as a human decision, not as a confident sentence.
 */
export function render(
  id: string,
  locale: Locale,
  slots: Readonly<Record<string, string | number | undefined>> = {},
): RenderResult {
  const tpl = BY_ID.get(id);
  if (!tpl) return { ok: false, templateId: id, missing: ["template:unknown"] };

  const missing: string[] = [];
  const body = tpl.body[locale].replace(SLOT_RE, (_match, name: string) => {
    const value = slots[name];
    const text = value === undefined || value === null ? "" : String(value).trim();
    if (text.length === 0) {
      if (!missing.includes(name)) missing.push(name);
      return "";
    }
    return text;
  });

  if (missing.length > 0) return { ok: false, templateId: id, missing };
  // Collapse the double spaces a trailing slot can leave behind.
  return { ok: true, templateId: id, body: body.replace(/[ \t]{2,}/g, " ").trim() };
}

/**
 * Join rendered blocks into one message. Any failed block is dropped and its
 * missing slots are reported, so the caller can decide between sending the
 * shorter message and handing off.
 */
export function compose(
  blocks: readonly RenderResult[],
): { body: string; templateIds: string[]; missing: string[] } {
  const ok = blocks.filter((b): b is Extract<RenderResult, { ok: true }> => b.ok);
  const missing = blocks.flatMap((b) => (b.ok ? [] : b.missing));
  return {
    body: ok.map((b) => b.body).join("\n\n"),
    templateIds: ok.map((b) => b.templateId),
    missing: [...new Set(missing)],
  };
}
