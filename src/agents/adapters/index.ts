import type { Activity, Channel, Contact, MessageDraft, Priority, SensitiveTopic } from "../types";
import { CHANNELS, AVAILABILITY } from "../config";
import type { Clock } from "../audit";
import { systemClock } from "../audit";

/**
 * Outbound ports, with in-memory implementations.
 *
 * Every port is asynchronous, including the in-memory ones. That is not
 * ceremony: the real implementations talk to Supabase, Meta and Telegram over
 * the network, and a synchronous interface would have forced the async boundary
 * to leak into the agents later. The mocks stay for tests and for running with
 * no credentials at all.
 *
 * Each port reports its own `status`, so `missingPorts()` can tell the owner
 * what is still unwired instead of pretending everything is connected.
 */

export type PortStatus = "connected" | "missing";

export interface Port {
  readonly name: string;
  readonly status: PortStatus;
}

/* ------------------------------------------------------------------ *
 * Messaging
 * ------------------------------------------------------------------ */

export interface SendResult {
  ok: boolean;
  /** Why a send was refused — never a thrown error, so a batch keeps going. */
  reason?: string;
  /** Provider id of the sent message, when there is one. */
  externalId?: string;
}

export interface MessagingPort extends Port {
  send(draft: MessageDraft): Promise<SendResult>;
}

/**
 * Mock messaging. Refuses any channel that is disabled or inbound-only, which
 * is what keeps a test (or a future webhook) from "sending" on e-mail while the
 * address in `SITE.email` is still a placeholder.
 */
export function createMockMessaging(): MessagingPort & { readonly sent: readonly MessageDraft[] } {
  const sent: MessageDraft[] = [];
  return {
    name: "messaging:mock",
    status: "missing",
    sent,
    async send(draft) {
      const channel = CHANNELS[draft.channel];
      if (!channel.enabled) return { ok: false, reason: `channel-disabled:${draft.channel}` };
      if (channel.automation === "inbound_only") return { ok: false, reason: `inbound-only:${draft.channel}` };
      sent.push(draft);
      return { ok: true };
    },
  };
}

/**
 * Route each channel to the port that can serve it, falling back for the rest.
 * WhatsApp goes to Meta, internal traffic goes to Telegram, and anything
 * unwired lands in the fallback so it is recorded rather than lost.
 */
export function createRoutedMessaging(
  routes: Partial<Record<Channel, MessagingPort>>,
  fallback: MessagingPort,
): MessagingPort {
  const wired = Object.values(routes).filter((p): p is MessagingPort => p !== undefined);
  return {
    name: `messaging:routed(${wired.map((p) => p.name).join(",") || "none"})`,
    status: wired.some((p) => p.status === "connected") ? "connected" : "missing",
    async send(draft) {
      return (routes[draft.channel] ?? fallback).send(draft);
    },
  };
}

/* ------------------------------------------------------------------ *
 * CRM / lead store
 * ------------------------------------------------------------------ */

export type LeadStage = "new" | "qualified" | "awaiting_partner" | "awaiting_client" | "won" | "lost" | "escalated";

export interface Lead {
  id: string;
  /** Stable key across channels — see `contactKey()`. */
  key: string;
  contact: Contact;
  channel: Channel;
  locale: string;
  activity?: Activity;
  dates: string[];
  partySize?: number;
  certified?: boolean;
  stage: LeadStage;
  sensitiveTopics: SensitiveTopic[];
  /** Follow-ups already sent — capped by `FOLLOW_UP.maxPerLead`. */
  followUps: number;
  /** When the last follow-up went out, so the schedule can space them. */
  lastFollowUpAt?: string;
  createdAt: string;
  updatedAt: string;
  notes: string[];
}

export type LeadUpsert = Omit<Lead, "id" | "key" | "createdAt" | "updatedAt" | "notes" | "followUps"> &
  Partial<Pick<Lead, "followUps">>;

/**
 * One person, one lead, whichever channel they use.
 *
 * Phone and e-mail are normalised; a social handle is the fallback. Someone who
 * writes on Instagram and then on WhatsApp from the same number is one lead —
 * that de-duplication is what stops a visitor getting two different answers.
 */
export function contactKey(contact: Contact, channel: Channel): string {
  const phone = contact.phone?.replace(/[^\d]/g, "");
  if (phone && phone.length >= 8) return `phone:${phone}`;
  const email = contact.email?.trim().toLowerCase();
  if (email) return `email:${email}`;
  const handle = contact.handle?.trim().toLowerCase();
  if (handle) return `handle:${handle}`;
  const name = contact.name?.trim().toLowerCase();
  return name ? `name:${channel}:${name}` : `anon:${channel}`;
}

export interface CrmPort extends Port {
  upsert(input: LeadUpsert): Promise<Lead>;
  find(key: string): Promise<Lead | undefined>;
  addNote(key: string, note: string): Promise<Lead | undefined>;
  setStage(key: string, stage: LeadStage): Promise<Lead | undefined>;
  countFollowUp(key: string, at: string): Promise<Lead | undefined>;
  all(): Promise<readonly Lead[]>;
}

/** Merge new facts over old ones without ever overwriting a known value with `undefined`. */
export function mergeLead(existing: Lead, input: LeadUpsert, now: string): Lead {
  return {
    ...existing,
    contact: { ...existing.contact, ...input.contact },
    activity: input.activity ?? existing.activity,
    dates: input.dates.length > 0 ? input.dates : existing.dates,
    partySize: input.partySize ?? existing.partySize,
    certified: input.certified ?? existing.certified,
    stage: input.stage,
    sensitiveTopics: [...new Set([...existing.sensitiveTopics, ...input.sensitiveTopics])],
    locale: input.locale,
    updatedAt: now,
  };
}

export function createMockCrm(clock: Clock = systemClock): CrmPort {
  const byKey = new Map<string, Lead>();
  let seq = 0;

  return {
    name: "crm:mock",
    status: "missing",
    async upsert(input) {
      const key = contactKey(input.contact, input.channel);
      const existing = byKey.get(key);
      const now = clock();
      if (existing) {
        const merged = mergeLead(existing, input, now);
        byKey.set(key, merged);
        return merged;
      }
      seq += 1;
      const lead: Lead = {
        id: `lead-${seq}`,
        key,
        followUps: input.followUps ?? 0,
        createdAt: now,
        updatedAt: now,
        notes: [],
        ...input,
      };
      byKey.set(key, lead);
      return lead;
    },
    async find(key) {
      return byKey.get(key);
    },
    async addNote(key, note) {
      const lead = byKey.get(key);
      if (!lead) return undefined;
      const updated: Lead = { ...lead, notes: [...lead.notes, note], updatedAt: clock() };
      byKey.set(key, updated);
      return updated;
    },
    async setStage(key, stage) {
      const lead = byKey.get(key);
      if (!lead) return undefined;
      const updated: Lead = { ...lead, stage, updatedAt: clock() };
      byKey.set(key, updated);
      return updated;
    },
    async countFollowUp(key, at) {
      const lead = byKey.get(key);
      if (!lead) return undefined;
      const updated: Lead = { ...lead, followUps: lead.followUps + 1, lastFollowUpAt: at, updatedAt: clock() };
      byKey.set(key, updated);
      return updated;
    },
    async all() {
      return [...byKey.values()];
    },
  };
}

/* ------------------------------------------------------------------ *
 * De-duplication
 * ------------------------------------------------------------------ */

/**
 * Records which events have been handled.
 *
 * This has to be a port, not a `Set`. Meta re-delivers webhooks, and on Vercel
 * every invocation is a fresh process — so an in-memory guard is empty exactly
 * when it matters. `claim()` is the whole interface: it returns `true` the first
 * time and `false` on a repeat, atomically.
 */
export interface SeenStore extends Port {
  claim(eventId: string, fingerprint: string, receivedAt: string): Promise<boolean>;
}

/** Same-text-in-same-thread window. Nervous people send twice. */
export const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

export function createMockSeenStore(): SeenStore {
  const ids = new Set<string>();
  const prints = new Map<string, number>();
  return {
    name: "seen:mock",
    status: "missing",
    async claim(eventId, fingerprint, receivedAt) {
      if (ids.has(eventId)) return false;
      const at = new Date(receivedAt).getTime();
      const previous = prints.get(fingerprint);
      if (previous !== undefined && Math.abs(at - previous) <= DUPLICATE_WINDOW_MS) return false;
      ids.add(eventId);
      prints.set(fingerprint, at);
      return true;
    },
  };
}

/* ------------------------------------------------------------------ *
 * Availability
 * ------------------------------------------------------------------ */

export type AvailabilityStatus = "unknown" | "free" | "full";

export interface AvailabilityAnswer {
  status: AvailabilityStatus;
  /** Always populated — the reason a client-facing sentence can cite, or not. */
  reason: string;
  /** True only when a trusted source said so. `false` forbids any confirmation. */
  authoritative: boolean;
}

export interface AvailabilityPort extends Port {
  check(activity: Activity, date: string, partySize: number): Promise<AvailabilityAnswer>;
}

/**
 * The honest adapter for `source: "partner_message"`.
 *
 * It always answers `unknown`, and that is not a stub to be filled in later —
 * it is the truth. Seats are held by the partner and released by a human
 * reading a message. Anything else here would be a machine guessing at a boat's
 * capacity, which is exactly the failure the mandate forbids.
 */
export function createPartnerMessageAvailability(): AvailabilityPort {
  return {
    name: `availability:${AVAILABILITY.source}`,
    status: "missing",
    async check(activity, date) {
      return {
        status: "unknown",
        reason: `Availability for ${activity} on ${date} is held by ${AVAILABILITY.partner} and confirmed by message.`,
        authoritative: false,
      };
    },
  };
}

/* ------------------------------------------------------------------ *
 * Calendar
 * ------------------------------------------------------------------ */

export interface CalendarEventInput {
  title: string;
  /** ISO date (YYYY-MM-DD). Times stay in the description until schedules are confirmed. */
  date: string;
  description: string;
  priority?: Priority;
}

export interface CalendarEvent extends CalendarEventInput {
  id: string;
  createdAt: string;
}

export interface CalendarPort extends Port {
  create(input: CalendarEventInput): Promise<CalendarEvent>;
  onDate(date: string): Promise<readonly CalendarEvent[]>;
}

/**
 * Mock calendar. Note what is NOT here: no delete, no update. The orchestrator
 * only ever reaches a calendar after a human released the action, and removing
 * an event is a human's job in the real calendar.
 */
export function createMockCalendar(clock: Clock = systemClock): CalendarPort & { readonly events: readonly CalendarEvent[] } {
  const events: CalendarEvent[] = [];
  let seq = 0;
  return {
    name: "calendar:mock",
    status: "missing",
    events,
    async create(input) {
      seq += 1;
      const event: CalendarEvent = { id: `cal-${seq}`, createdAt: clock(), ...input };
      events.push(event);
      return event;
    },
    async onDate(date) {
      return events.filter((e) => e.date === date);
    },
  };
}

/* ------------------------------------------------------------------ *
 * Bundle
 * ------------------------------------------------------------------ */

export interface Ports {
  messaging: MessagingPort;
  crm: CrmPort;
  availability: AvailabilityPort;
  calendar: CalendarPort;
  seen: SeenStore;
}

export function createMockPorts(clock: Clock = systemClock): Ports {
  return {
    messaging: createMockMessaging(),
    crm: createMockCrm(clock),
    availability: createPartnerMessageAvailability(),
    calendar: createMockCalendar(clock),
    seen: createMockSeenStore(),
  };
}

/** Which connections are still missing — feeds the ops report and the docs checklist. */
export function missingPorts(ports: Ports): string[] {
  return Object.values(ports)
    .filter((p) => p.status === "missing")
    .map((p) => p.name);
}
