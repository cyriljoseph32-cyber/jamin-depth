#!/usr/bin/env node
/**
 * Chantier 0 — activation de COCO COMMAND, en une commande.
 *
 * Ce script ne crée aucun compte : il vérifie et il branche. Les comptes
 * (BotFather, Supabase, Vercel) restent à créer à la main — c'est le seul
 * travail qui ne peut pas être délégué.
 *
 *   node scripts/activate.mjs check     — que manque-t-il ? (par défaut)
 *   node scripts/activate.mjs chats     — l'id de chaque chat Telegram, à copier
 *   node scripts/activate.mjs webhook   — relie Telegram à /api/agents/telegram
 *   node scripts/activate.mjs ping      — envoie un message de test dans DAILY
 *   node scripts/activate.mjs all       — check + webhook + ping
 *
 * Les variables sont lues dans l'environnement (ou dans .env.local s'il existe).
 * Aucun secret n'est affiché en clair : le script dit « posée » ou « manquante ».
 */

import { readFileSync, existsSync } from "node:fs";

// ── .env.local, si présent, sans dépendance dotenv ──────────────────────────
if (existsSync(".env.local")) {
  for (const raw of readFileSync(".env.local", "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue; // l'environnement réel gagne
    process.env[key] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
}

const REQUIRED = [
  ["TELEGRAM_BOT_TOKEN", "BotFather → /newbot"],
  ["TELEGRAM_WEBHOOK_SECRET", "chaîne au hasard, ≥ 32 caractères"],
  ["TELEGRAM_ALLOWED_CHAT_IDS", "ton id à toi, et rien d'autre"],
  ["TELEGRAM_CHAT_COMMAND", "chat COMMAND"],
  ["TELEGRAM_CHAT_ALERTS", "chat ALERTS"],
  ["TELEGRAM_CHAT_DAILY", "chat DAILY"],
  ["TELEGRAM_CHAT_PROJECT_COCO", "chat PROJECT_COCO"],
  ["TELEGRAM_CHAT_PROJECT_DIVING", "chat PROJECT_DIVING"],
  ["TELEGRAM_CHAT_PROJECT_RUGBY", "chat PROJECT_RUGBY"],
  ["SUPABASE_URL", "Supabase → Project Settings → API"],
  ["SUPABASE_SERVICE_ROLE_KEY", "même page — ne jamais exposer côté navigateur"],
  ["COMMAND_INGEST_TOKEN", "à générer, puis poser AUSSI sur coco2 et CSRA"],
  ["CRON_SECRET", "⚠️ à RÉGÉNÉRER — l'ancienne valeur a fuité le 20/08"],
  ["ANTHROPIC_API_KEY", "console.anthropic.com"],
  ["NEXT_PUBLIC_SITE_URL", "https://<domaine-de-jamin-depth>"],
];

const has = (k) => Boolean((process.env[k] || "").trim());
const ok = (s) => `\x1b[32m${s}\x1b[0m`;
const bad = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

function siteUrl() {
  const explicit = (process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = (process.env.VERCEL_URL || "").trim();
  return vercel ? `https://${vercel}` : "";
}

async function tg(method, body) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN manquant");
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!json.ok) throw new Error(`${method}: ${json.description || res.status}`);
  return json.result;
}

async function check() {
  console.log("\n── Variables ─────────────────────────────────────────────\n");
  let missing = 0;
  for (const [key, hint] of REQUIRED) {
    if (has(key)) console.log(`  ${ok("●")} ${key}`);
    else {
      missing++;
      console.log(`  ${bad("○")} ${key}  ${dim("— " + hint)}`);
    }
  }

  if (has("TELEGRAM_BOT_TOKEN")) {
    try {
      const me = await tg("getMe");
      console.log(`\n  ${ok("●")} Bot joignable : @${me.username}`);
      const info = await tg("getWebhookInfo");
      if (info.url) {
        console.log(`  ${ok("●")} Webhook : ${info.url}`);
        if (info.last_error_message) {
          console.log(`  ${bad("○")} Dernière erreur Telegram : ${info.last_error_message}`);
        }
      } else {
        console.log(`  ${bad("○")} Webhook non relié — lance : node scripts/activate.mjs webhook`);
      }
    } catch (err) {
      console.log(`\n  ${bad("○")} Telegram : ${err.message}`);
    }
  }

  if (has("SUPABASE_URL") && has("SUPABASE_SERVICE_ROLE_KEY")) {
    // On interroge une table du schéma : si elle répond, le SQL a bien tourné.
    const url = `${process.env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/command_events?select=event_id&limit=1`;
    try {
      const res = await fetch(url, {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });
      if (res.ok) console.log(`  ${ok("●")} Supabase : schéma en place (command_events répond)`);
      else if (res.status === 404) {
        console.log(`  ${bad("○")} Supabase joignable mais table absente — exécuter supabase/schema.sql`);
      } else console.log(`  ${bad("○")} Supabase : HTTP ${res.status}`);
    } catch (err) {
      console.log(`  ${bad("○")} Supabase injoignable : ${err.message}`);
    }
  }

  const base = siteUrl();
  console.log(`\n  ${base ? ok("●") : bad("○")} URL du site : ${base || "inconnue"}`);
  console.log(
    missing === 0
      ? `\n${ok("Chantier 0 : toutes les variables sont posées.")}\n`
      : `\n${bad(`${missing} variable(s) manquante(s).`)} ${dim("Le brief du matin n'arrivera pas tant qu'elles manquent.")}\n`,
  );
  return missing;
}

/**
 * Les id de chat ne se devinent pas. La méthode fiable : écrire un message
 * dans chacun des 6 chats, puis lancer cette commande — getUpdates les liste.
 */
async function chats() {
  const updates = await tg("getUpdates", { limit: 100 });
  const seen = new Map();
  for (const u of updates) {
    const msg = u.message || u.channel_post || u.edited_message;
    if (!msg || !msg.chat) continue;
    const c = msg.chat;
    seen.set(String(c.id), c.title || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.type);
  }
  if (seen.size === 0) {
    console.log(
      "\nAucun chat vu.\n" +
        "  1. Crée les 6 chats (ou groupes) et ajoute le bot dedans.\n" +
        "  2. Écris n'importe quel message dans CHACUN.\n" +
        "  3. Relance : node scripts/activate.mjs chats\n" +
        dim("  (Si le webhook est déjà relié, Telegram ne renvoie plus d'updates ici :\n" +
            "   supprime-le le temps de relever les id, puis rebranche-le.)\n"),
    );
    return;
  }
  console.log("\n── Chats vus par le bot ──────────────────────────────────\n");
  for (const [id, name] of seen) console.log(`  ${id.padEnd(16)} ${name}`);
  console.log(dim("\n  Reporte chaque id dans la variable TELEGRAM_CHAT_* correspondante.\n"));
}

async function webhook() {
  const base = siteUrl();
  if (!base) throw new Error("NEXT_PUBLIC_SITE_URL manquant — impossible de construire l'URL du webhook");
  const secret = (process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
  if (!secret) throw new Error("TELEGRAM_WEBHOOK_SECRET manquant — le webhook serait ouvert à tous");
  const url = `${base}/api/agents/telegram`;
  await tg("setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  console.log(`\n${ok("Webhook relié")} → ${url}\n`);
}

async function ping() {
  const chat = process.env.TELEGRAM_CHAT_DAILY || process.env.TELEGRAM_CHAT_COMMAND;
  if (!chat) throw new Error("TELEGRAM_CHAT_DAILY manquant");
  await tg("sendMessage", {
    chat_id: chat,
    text: "✅ COCO COMMAND est branché. Si tu lis ceci, le chantier 0 tient la route.",
  });
  console.log(`\n${ok("Message de test envoyé.")}\n`);
}

const action = process.argv[2] || "check";
const run = {
  check,
  chats,
  webhook,
  ping,
  all: async () => {
    const missing = await check();
    if (missing > 0) {
      console.log(bad("On s'arrête là : compléter les variables avant de brancher le webhook.\n"));
      process.exitCode = 1;
      return;
    }
    await webhook();
    await ping();
  },
}[action];

if (!run) {
  console.error(`Action inconnue : ${action}. Utiliser check | chats | webhook | ping | all`);
  process.exit(1);
}

run().catch((err) => {
  console.error(`\n${bad("Échec")} : ${err.message}\n`);
  process.exit(1);
});
