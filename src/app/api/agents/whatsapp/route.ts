import { createRuntime } from "@/agents/runtime";
import { eventsFromWebhook, verificationChallenge, verifySignature, whatsappFromEnv } from "@/agents/adapters/whatsapp";

/**
 * WhatsApp Cloud API webhook.
 *
 * GET  — Meta's subscription handshake when the URL is saved in the app dashboard.
 * POST — incoming customer messages.
 *
 * Two things here are not negotiable:
 *
 * 1. The signature is verified against the RAW body before anything is parsed.
 *    An unsigned endpoint lets anyone impersonate a customer — invent a medical
 *    disclosure, a booking, a complaint — and the whole safety design collapses.
 *
 * 2. The work happens BEFORE the response. Vercel freezes the function once it
 *    returns, so anything deferred would silently never run. The pass is
 *    rule-based and fast, so this is affordable; Meta retries on non-200, and
 *    the `processed_events` table makes a retry harmless.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  const cfg = whatsappFromEnv();
  if (!cfg) return new Response("not configured", { status: 503 });

  const result = verificationChallenge(new URL(req.url).searchParams, cfg.verifyToken);
  if (!result.ok) return new Response("forbidden", { status: 403 });
  return new Response(result.challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

export async function POST(req: Request) {
  const cfg = whatsappFromEnv();
  if (!cfg) return new Response("not configured", { status: 503 });

  // Raw text, not req.json(): re-serialising changes the bytes and the HMAC.
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"), cfg.appSecret)) {
    console.error("whatsapp webhook: invalid signature");
    return new Response("invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    // Malformed but signed: acknowledge, or Meta retries it forever.
    return new Response("ok", { status: 200 });
  }

  const events = eventsFromWebhook(payload);
  if (events.length === 0) return new Response("ok", { status: 200 });

  const { bus } = createRuntime();

  for (const event of events) {
    try {
      await bus.handle(event);
    } catch (err) {
      // One bad message must not cost us the others in the same delivery, and a
      // 500 here would make Meta replay the whole batch.
      console.error(`whatsapp webhook: handling ${event.id} failed:`, err);
    }
  }

  return new Response("ok", { status: 200 });
}
