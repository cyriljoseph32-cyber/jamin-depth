-- Chantier 2 — la base unique de leads
--
-- À exécuter une fois dans l'éditeur SQL Supabase. Idempotent : chaque
-- instruction est gardée, la relancer ne casse rien.
--
-- Pourquoi : `leads` était la table de jamin-depth seul, sans dimension projet.
-- Depuis que coco2 et CSRA poussent leurs leads dans la même ingestion, il faut
-- pouvoir répondre à « combien de leads rugby ? » sans confondre avec la plongée.
-- La déduplication reste celle de `contactKey()` : une personne, une ligne,
-- quel que soit le canal — donc `venture` ne fait pas partie de la clé.
-- Quelqu'un qui écrit pour le rugby puis pour la plongée reste UNE personne ;
-- `ventures` accumule ses centres d'intérêt.

alter table public.leads
  add column if not exists venture text not null default 'DIVING';

-- Une même personne peut toucher plusieurs activités. On garde la liste plutôt
-- que d'écraser : perdre l'info « cette famille fait aussi du rugby » coûterait
-- plus cher que la place prise par un tableau de 4 valeurs maximum.
alter table public.leads
  add column if not exists ventures text[] not null default '{}';

-- D'où vient la personne, pour retrouver le premier point de contact.
alter table public.leads
  add column if not exists source text;

-- `/status rugby` filtre sur venture + stage : l'index sert exactement ça.
create index if not exists leads_venture_stage_idx on public.leads (venture, stage);
create index if not exists leads_ventures_idx      on public.leads using gin (ventures);

-- Les doublons d'index relevés par le linter Supabase le 12/09 : deux paires
-- strictement identiques, créées par deux passages successifs du schéma.
-- En garder une de chaque suffit ; l'autre coûte de l'écriture à chaque insert.
drop index if exists public.command_kpis_metric_idx;
drop index if exists public.command_tasks_status_idx;

-- ─────────────────────────────────────────────────────────────
-- Chantier 3 — le refus, rendu indélébile
--
-- `opted_out` double le stade `lost`. Les deux disent la même chose, et c'est
-- voulu : le jour où un stade est mal écrit par un chemin qu'on n'avait pas
-- prévu, il reste un drapeau que rien ne remet à faux. R1 (relance après refus)
-- a coûté assez cher pour mériter cette redondance.
alter table public.leads
  add column if not exists opted_out boolean not null default false;

-- La requête des relances écarte les refus d'entrée de jeu.
create index if not exists leads_relançables_idx
  on public.leads (stage, opted_out)
  where opted_out = false;
