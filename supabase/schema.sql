-- Jammin's Depths — agent system schema
--
-- Run once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: every statement is guarded.
--
-- Access model: these tables are reached ONLY from server-side API routes using
-- the service-role key. Row-level security is enabled with no policies, so an
-- anon or authenticated client — including anything running in a browser — can
-- read nothing. That is deliberate: the tables hold customer contact details,
-- flagged health mentions and message drafts.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- leads
create table if not exists public.leads (
  id                uuid primary key default gen_random_uuid(),
  key               text not null unique,          -- see contactKey(): one person, one row
  contact           jsonb not null default '{}'::jsonb,
  channel           text not null,
  locale            text not null default 'fr',
  activity          text,
  dates             text[] not null default '{}',
  party_size        integer,
  certified         boolean,
  stage             text not null default 'new',
  sensitive_topics  text[] not null default '{}',
  follow_ups        integer not null default 0,
  last_follow_up_at timestamptz,
  notes             text[] not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- The daily brief looks up who is diving on a given date.
create index if not exists leads_dates_idx on public.leads using gin (dates);
create index if not exists leads_stage_idx on public.leads (stage);

-- ---------------------------------------------------- queue_items
create table if not exists public.queue_items (
  id            text primary key,                  -- uuid generated in the app
  event_id      text not null,
  agent         text not null,
  action        jsonb not null,                     -- the full ProposedAction, draft included
  priority      text not null,                     -- P0…P3
  approver      text not null default 'owner',
  reasons       text[] not null default '{}',       -- rule:… / guard:…
  summary       text not null,
  queued_at     timestamptz not null default now(),
  status        text not null default 'pending',    -- pending | approved | rejected | expired
  decided_by    text,
  decided_at    timestamptz,
  decision_note text,
  executed_at   timestamptz                         -- stamped after the action ran
);

-- The Telegram card and the daily digest both read "what is pending, urgent first".
create index if not exists queue_items_pending_idx on public.queue_items (status, priority, queued_at);
create index if not exists queue_items_event_idx on public.queue_items (event_id);

-- ---------------------------------------------------- audit_log
create table if not exists public.audit_log (
  id       bigserial primary key,
  at       timestamptz not null default now(),
  event_id text not null,
  agent    text not null,
  step     text not null,                           -- received | classified | queued | blocked | …
  detail   text not null
);

create index if not exists audit_log_event_idx on public.audit_log (event_id, at);

-- ------------------------------------------- processed_events
-- De-duplication. Meta re-delivers webhooks, and on Vercel every invocation is
-- a fresh process, so this cannot live in memory. The primary key IS the lock:
-- a repeat delivery collides and the orchestrator stops.
create table if not exists public.processed_events (
  event_id    text primary key,
  fingerprint text not null,                        -- thread + normalised text
  received_at timestamptz not null,
  created_at  timestamptz not null default now()
);

create index if not exists processed_events_fingerprint_idx
  on public.processed_events (fingerprint, received_at desc);

-- ---------------------------------------------------------------- RLS
-- Enabled with no policies: the service-role key bypasses RLS, everyone else
-- gets nothing. Do not add a policy without deciding who should read customer
-- data and flagged health mentions.
alter table public.leads             enable row level security;
alter table public.queue_items       enable row level security;
alter table public.audit_log         enable row level security;
alter table public.processed_events  enable row level security;

-- ------------------------------------------------------------- retention
-- Optional housekeeping. `processed_events` only needs a short memory (Meta
-- retries within minutes) and the journal grows forever otherwise.
-- Schedule with pg_cron if you want it automatic:
--   select cron.schedule('agents-prune', '0 3 * * *', $$
--     delete from public.processed_events where created_at < now() - interval '30 days';
--     delete from public.audit_log       where at         < now() - interval '365 days';
--   $$);
