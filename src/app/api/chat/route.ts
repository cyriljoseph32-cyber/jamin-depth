import Anthropic from "@anthropic-ai/sdk";
import { ASSISTANT, buildSystemPrompt, sanitizeMessages } from "@/lib/assistant";
import { getDictionary, isLocale, defaultLocale, type Locale } from "@/content/i18n";

/** Read the visitor's locale off the request body; fall back to the default. */
function localeFrom(body: unknown): Locale {
  const raw = (body as { locale?: unknown } | null)?.locale;
  return typeof raw === "string" && isLocale(raw) ? raw : defaultLocale;
}

/**
 * POST /api/chat — streams a Claude reply for the on-site assistant.
 *
 * - Runs server-side only; the ANTHROPIC_API_KEY is never exposed to the client.
 * - Stateless: conversation memory lives in the browser (session only). The
 *   client sends the recent history each request; nothing is stored here.
 * - Degrades gracefully when the key is absent (e.g. before Vercel is configured).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const locale = localeFrom(body);
  const dict = getDictionary(locale);

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return Response.json({ error: dict.chat.notConfigured }, { status: 503 });
  }

  const messages = sanitizeMessages((body as { messages?: unknown } | null)?.messages);
  if (messages.length === 0 || messages[messages.length - 1]?.role !== "user") {
    return Response.json({ error: "Send a message to start." }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const run = anthropic.messages.stream({
          model: ASSISTANT.model,
          max_tokens: ASSISTANT.maxOutputTokens,
          system: buildSystemPrompt(locale),
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        });

        run.on("text", (delta) => {
          controller.enqueue(encoder.encode(delta));
        });

        await run.finalMessage();
        controller.close();
      } catch (err) {
        // Surface a short, safe message; log server-side only.
        console.error("assistant stream error:", err);
        try {
          controller.enqueue(
            encoder.encode(dict.chat.interrupted),
          );
        } catch {
          /* stream already closed */
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
