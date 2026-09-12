#!/usr/bin/env node
/**
 * Chantier 2.4 / 2.5 — importer les registres CSRA tenus à la main dans la
 * base unique.
 *
 *   brain/pipeline.md          → contacts suivis (écoles, parents, fournisseurs)
 *   brain/sponsor-prospects.md → prospects sponsors, par catégorie
 *
 * Ces deux fichiers sont des tableaux markdown écrits pour être lus par un
 * humain : on ne prétend pas les comprendre parfaitement. Le script extrait ce
 * qui est mécaniquement sûr — nom, e-mail, téléphone, section, statut — et
 * laisse le reste dans `details`, tel quel. Rien n'est deviné.
 *
 *   node scripts/import-leads.mjs --repo ../Coconut-Samui-Rugby-Academy
 *       → écrit import-leads.json et n'envoie RIEN (par défaut : essai à blanc)
 *
 *   node scripts/import-leads.mjs --repo <chemin> --push
 *       → pousse chaque ligne vers COMMAND_API_URL (COMMAND_INGEST_TOKEN requis)
 *
 * Sécurité de l'import : tout part en `status: PLANNED`, `needs_owner: false`,
 * `type: NOTE`. Un import ne déclenche aucune relance et ne réveille personne —
 * il remplit la base, il ne prend aucune initiative. La déduplication est faite
 * en aval par l'empreinte d'événement du journal.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const REPO = flag("repo", "../Coconut-Samui-Rugby-Academy");
const PUSH = args.includes("--push");
const OUT = flag("out", "import-leads.json");

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]{2,}/g;
const PHONE_RE = /(?:\+|☎️\s*)[\d][\d\s().-]{7,}\d/g;

/** `**Gras**`, `~~barré~~`, backticks, liens : on ne garde que le texte. */
function plain(cell) {
  return cell
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Découpe un markdown en sections (## titre) contenant des lignes de tableau. */
function tableRows(markdown) {
  const rows = [];
  let section = "";
  let header = null;
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("#")) {
      section = plain(line.replace(/^#+\s*/, ""));
      header = null;
      continue;
    }
    if (!line.startsWith("|")) {
      header = null;
      continue;
    }
    const cells = line.slice(1, line.endsWith("|") ? -1 : undefined).split("|");
    // La ligne de séparation |---|---| clôt l'en-tête, elle n'est pas une donnée.
    if (cells.every((c) => /^\s*:?-{2,}:?\s*$/.test(c))) continue;
    if (!header) {
      header = cells.map((c) => plain(c).toLowerCase());
      continue;
    }
    rows.push({ section, header, cells: cells.map(plain) });
  }
  return rows;
}

const STATUS_HINTS = [
  [/⛔|❌|refus|clos/i, "refusé / clos"],
  [/✅/, "abouti"],
  [/🎯/, "brouillon prêt / à contacter"],
  [/📅/, "en attente de réponse"],
  [/🤝/, "échange en cours"],
];

function readableStatus(text) {
  for (const [re, label] of STATUS_HINTS) if (re.test(text)) return label;
  return "statut non classé";
}

function buildEvent({ source, section, title, detail, status, emails, phones }) {
  // Le résumé tient en 300 caractères et ne porte pas de PII inutile.
  const summary = `Import ${source} — ${title}`.slice(0, 300);
  return {
    venture: "RUGBY",
    agent: "import-leads",
    type: "NOTE",
    priority: "P3",
    status: "PLANNED",
    summary,
    details: [
      section && `section=${section}`,
      emails.length && `emails=${emails.join(", ")}`,
      phones.length && `tel=${phones.join(", ")}`,
      `statut_registre=${readableStatus(status)}`,
      detail && `note=${detail.slice(0, 600)}`,
    ]
      .filter(Boolean)
      .join(" · "),
    links: [],
    next_action: "Reprise du registre manuel — à qualifier dans la base unique.",
    needs_owner: false,
    category: /sponsor|partenaire|fournisseur|textile/i.test(`${source} ${section}`) ? "partner" : "sales",
    repo: "Coconut-Samui-Rugby-Academy",
    // Empreinte stable : ré-importer le même fichier ne crée pas de doublon.
    event_id: `import-${source}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48)}`,
  };
}

function harvest(path, source) {
  let md;
  try {
    md = readFileSync(path, "utf8");
  } catch {
    console.error(`  introuvable : ${path}`);
    return [];
  }
  const events = [];
  for (const { section, header, cells } of tableRows(md)) {
    const joined = cells.join(" ");
    const emails = [...new Set(joined.match(EMAIL_RE) || [])];
    const phones = [...new Set((joined.match(PHONE_RE) || []).map((p) => p.replace(/☎️\s*/, "").trim()))];
    const title = cells[0] || "";
    // Une ligne sans nom, ou une ligne de devis chiffré (« Qté | PU | Total »),
    // n'est pas un contact : on la laisse dans le markdown.
    if (!title || title.length < 3) continue;
    if (header.some((h) => /qté|pu \(|total \(/.test(h))) continue;
    if (!emails.length && !phones.length && !/contact|école|fournisseur|établissement|marque|entreprise/.test(header.join(" "))) {
      continue;
    }
    const statusCell = cells[cells.length - 1] || "";
    events.push(
      buildEvent({
        source,
        section,
        title,
        detail: cells.slice(1, -1).join(" · "),
        status: statusCell,
        emails,
        phones,
      }),
    );
  }
  return events;
}

const events = [
  ...harvest(join(REPO, "brain", "pipeline.md"), "pipeline"),
  ...harvest(join(REPO, "brain", "sponsor-prospects.md"), "sponsors"),
];

// Dernier filet anti-doublon : deux lignes au même event_id (même contact cité
// dans deux tableaux) ne produisent qu'un événement.
const unique = [...new Map(events.map((e) => [e.event_id, e])).values()];

console.log(`\n${unique.length} contacts extraits (${events.length - unique.length} doublon(s) écarté(s)).`);
const bySource = {};
for (const e of unique) {
  const k = e.event_id.split("-")[1];
  bySource[k] = (bySource[k] || 0) + 1;
}
console.log(Object.entries(bySource).map(([k, n]) => `  ${k}: ${n}`).join("\n"));

writeFileSync(OUT, JSON.stringify(unique, null, 2));
console.log(`\nÉcrit dans ${OUT}.`);

if (!PUSH) {
  console.log("Essai à blanc — rien n'a été envoyé. Relire le fichier, puis relancer avec --push.\n");
  process.exit(0);
}

const url = process.env.COMMAND_API_URL;
const token = process.env.COMMAND_INGEST_TOKEN;
if (!url || !token) {
  console.error("\nCOMMAND_API_URL et COMMAND_INGEST_TOKEN sont requis pour --push.\n");
  process.exit(1);
}

let sent = 0;
let failed = 0;
for (const event of unique) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(event),
    });
    if (res.ok) sent++;
    else {
      failed++;
      console.error(`  ✗ ${event.summary} → HTTP ${res.status} ${await res.text().catch(() => "")}`);
    }
  } catch (err) {
    failed++;
    console.error(`  ✗ ${event.summary} → ${err.message}`);
  }
  // L'ingestion notifie Telegram : on ne la noie pas sous 130 appels d'un coup.
  await new Promise((r) => setTimeout(r, 250));
}
console.log(`\n${sent} envoyés, ${failed} en échec.\n`);
