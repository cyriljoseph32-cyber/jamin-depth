"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { SITE } from "@/content/site";
import type { Locale, Dictionary } from "@/content/i18n";
import { buildWaLink, recoveryPrefill } from "@/lib/whatsapp";
import { ChatIcon, CloseIcon, SendIcon, WhatsAppIcon } from "@/components/ui/Icons";

type Role = "user" | "assistant";
interface Msg {
  role: Role;
  content: string;
}

const STORAGE_KEY = "jd_chat_v1";

export function ChatWidget({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const C = dict.chat;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);

  const logRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Restore session memory (this tab only).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Msg[];
        if (Array.isArray(parsed)) setMessages(parsed);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Persist session memory.
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* ignore */
    }
  }, [messages]);

  // Keep the transcript scrolled to the latest line.
  useEffect(() => {
    if (open && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, open, streaming]);

  // Focus the input on open; ESC closes.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      const history: Msg[] = [...messages, { role: "user", content: trimmed }];
      setMessages([...history, { role: "assistant", content: "" }]);
      setInput("");
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale, messages: history }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          let msg = C.unreachable;
          try {
            const data = (await res.json()) as { error?: string };
            if (data?.error) msg = data.error;
          } catch {
            /* keep default */
          }
          setMessages((m) => {
            const next = [...m];
            next[next.length - 1] = { role: "assistant", content: msg };
            return next;
          });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setMessages((m) => {
            const next = [...m];
            next[next.length - 1] = { role: "assistant", content: acc };
            return next;
          });
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = {
            role: "assistant",
            content:
              C.failed,
          };
          return next;
        });
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, streaming, locale, C.unreachable, C.failed],
  );

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  return (
    <>
      {/* Launcher — bottom-left so it never collides with the WhatsApp FAB. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="jd-chat-panel"
        aria-label={open ? C.close : C.open}
        className="fixed bottom-5 left-5 z-50 flex items-center gap-2 rounded-full border border-foam/15 bg-abyss-2/95 p-3 text-foam shadow-lg shadow-black/40 backdrop-blur transition-transform duration-200 hover:scale-[1.03] focus-visible:scale-[1.03] sm:py-3 sm:pl-3 sm:pr-4"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <span className="flex h-6 w-6 items-center justify-center text-signal">
          {open ? <CloseIcon width={20} height={20} /> : <ChatIcon width={20} height={20} />}
        </span>
        <span className="hidden font-mono text-xs font-semibold uppercase tracking-[0.12em] sm:inline">
          {C.launcherLabel}
        </span>
      </button>

      {open && (
        <div
          id="jd-chat-panel"
          role="dialog"
          aria-label={`${SITE.name} assistant`}
          className="fixed bottom-24 left-4 z-50 flex w-[calc(100vw-2rem)] max-w-[380px] flex-col overflow-hidden rounded-[var(--radius)] border border-foam/15 bg-abyss/98 shadow-2xl shadow-black/60 backdrop-blur-md sm:left-5"
          style={{ height: "min(70vh, 560px)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-foam/10 px-4 py-3">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-signal" aria-hidden />
              <span className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-sand">
                {SITE.name} · Assistant
              </span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={C.close}
              className="inline-flex h-8 w-8 items-center justify-center text-foam-dim transition-colors hover:text-foam"
            >
              <CloseIcon width={18} height={18} />
            </button>
          </div>

          {/* Transcript */}
          <div
            ref={logRef}
            className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
            role="log"
            aria-live="polite"
            aria-label={C.conversation}
          >
            <Bubble role="assistant">{C.greeting}</Bubble>

            {messages.length === 0 && (
              <ul className="flex flex-wrap gap-2 pt-1">
                {C.suggestions.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => void send(s)}
                      className="rounded-full border border-foam/15 px-3 py-1.5 text-left text-xs text-foam-dim transition-colors hover:border-signal hover:text-foam"
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {messages.map((m, i) => (
              <Bubble key={i} role={m.role}>
                {m.content || (streaming && i === messages.length - 1 ? <TypingDots label={C.typing} /> : "")}
              </Bubble>
            ))}
          </div>

          {/* Composer */}
          <form onSubmit={onSubmit} className="border-t border-foam/10 p-3">
            <label htmlFor="jd-chat-input" className="sr-only">
              Message the assistant
            </label>
            <div className="flex items-end gap-2">
              <textarea
                id="jd-chat-input"
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                maxLength={2000}
                placeholder={C.inputPlaceholder}
                className="max-h-28 min-h-[2.75rem] flex-1 resize-none rounded-[var(--radius)] border border-foam/15 bg-blueblack/60 px-3 py-2.5 text-sm text-foam placeholder:text-foam-dim/50 outline-none transition-colors focus:border-signal"
              />
              <button
                type="submit"
                disabled={streaming || !input.trim()}
                aria-label={C.send}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius)] bg-signal text-ink transition-colors hover:bg-signal-600 disabled:opacity-40"
              >
                <SendIcon width={18} height={18} />
              </button>
            </div>
            <a
              href={buildWaLink(recoveryPrefill(dict.wa))}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-foam-dim transition-colors hover:text-signal"
            >
              <WhatsAppIcon width={13} height={13} /> Talk to the diver on WhatsApp
            </a>
          </form>
        </div>
      )}
    </>
  );
}

function Bubble({ role, children }: { role: Role; children: React.ReactNode }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-[var(--radius)] bg-signal/15 px-3 py-2 text-sm text-foam"
            : "max-w-[90%] rounded-[var(--radius)] border border-foam/10 bg-abyss-2/70 px-3 py-2 text-sm text-foam-dim"
        }
      >
        <p className="whitespace-pre-wrap leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

function TypingDots({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={label}>
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-foam-dim" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-foam-dim [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-foam-dim [animation-delay:300ms]" />
    </span>
  );
}
