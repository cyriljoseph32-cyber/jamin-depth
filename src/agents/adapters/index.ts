import type { Activity, Channel, Contact, MessageDraft, Priority, SensitiveTopic } from "../types";
import { CHANNELS, AVAILABILITY } from "../config";
import type { Clock } from "../audit";
import { systemClock } from "../audit";

/**
 * Outbound ports, with in-memory implementations.
 *
 * The audit found no connected system of record: bookings live with the partner
 * dive centre, reached by message. So every port here is a real interface with a
 * mock behind it, and each one reports its own `status`. Nothing pretends to be
 * connected, and no credential is invented — see docs/agents/CONNECTORS.md for
 * what each connection unlocks.
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
  upsert(input: LeadUpsert): Lead;
  find(key: string): Lead | undefined;
  addNote(key: string, note: string): Lead | undefined;
  setStage(key: string, stage: LeadStage): Lead | undefined;
  countFollowUp(key: string): Lead | undefined;
  all(): readonly Lead[];
}

export function createMockCrm(clock: Clock = systemClock): CrmPort {
  const byKey = new Map<string, Lead>();
  let seq = 0;

  return {
    name: "crm:mock",
    status: "missing",
    upsert(input) {
      const key = contactKey(input.contact, input.channel);
      const existing = byKey.get(key);
      const now = clock();
      if (existing) {
        const merged: Lead = {
          ...existing,
          // Newer facts win, but a known value is never overwritten with undefined.
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
    find(key) {
      return byKey.get(key);
    },
    addNote(key, note) {
      const lead = byKey.get(key);
      if (!lead) return undefined;
      const updated: Lead = { ...lead, notes: [...lead.notes, note], updatedAt: clock() };
      byKey.set(key, updated);
      return updated;
    },
    setStage(key, stage) {
      const lead = byKey.get(key);
      if (!lead) return undefined;
      const updated: Lead = { ...lead, stage, updatedAt: clock() };
      byKey.set(key, updated);
      return updated;
    },
    countFollowUp(key) {
      const lead = byKey.get(key);
      if (!lead) return undefined;
      const updated: Lead = { ...lead, followUps: lead.followUps + 1, updatedAt: clock() };
      byKey.set(key, updated);
      return updated;
    },
    all() {
      return [...byKey.values()];
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
}

export function createMockPorts(clock: Clock = systemClock): Ports {
  return {
    messaging: createMockMessaging(),
    crm: createMockCrm(clock),
    availability: createPartnerMessageAvailability(),
    calendar: createMockCalendar(clock),
  };
}

/** Which connections are still missing — feeds the ops report and the docs checklist. */
export function missingPorts(ports: Ports): string[] {
  return Object.values(ports)
    .filter((p) => p.status === "missing")
    .map((p) => p.name);
}
