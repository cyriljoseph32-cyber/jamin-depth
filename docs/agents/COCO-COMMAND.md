# COCO COMMAND — le chef d'état-major

Le système d'agents [`src/agents/`](../../src/agents) fait tourner **la plongée**.
COCO COMMAND ([`src/command/`](../../src/command)) est la couche au-dessus : elle
pilote **toutes** les activités de Cyril, ne parle qu'à une seule personne, et
n'a qu'une interface — Telegram.

Trois idées, et rien d'autre :

1. **Tout laisse une trace.** Chaque action d'un agent écrit un événement dans le
   journal opérationnel, *puis* est notifiée. Le journal est la source de
   vérité ; Telegram n'en est que l'affichage.
2. **Chaque geste a un niveau.** De 0 (observer) à 4 (critique). À partir de 3,
   rien ne part sans une décision — Approuver/Rejeter d'un tap sur la carte
   Telegram, ou `/approve`/`/reject <event_id>` en secours (clavier, chat sans
   boutons).
3. **Le fondateur n'est dérangé que quand c'est nécessaire.** Urgences et
   validations partent seules ; le reste attend le récapitulatif de 30 minutes.

## Les niveaux

| Niveau | Ce que c'est | Ce qui se passe |
| --- | --- | --- |
| A0 — observer | lire, classer, analyser | exécuté, journalisé |
| A1 — préparer | brouillon, plan, proposition | exécuté, remonte dans le bilan |
| A2 — réversible | écriture interne, planification non publique | exécuté et notifié |
| A3 — externe/sensible | envoyer, publier, modifier un dossier client | **attend `/approve`** |
| A4 — critique | paiement, contrat, accès, incident | **s'arrête et alerte** |

Le niveau est dérivé dans [`levels.ts`](../../src/command/levels.ts) à partir du
type d'action et de la classe de risque déjà définie par
[`policy.ts`](../../src/agents/policy.ts). Il ne remplace pas ce garde-fou : il
ne peut que le durcir. C'est testé — `needsOwnerApproval` renvoie toujours vrai à
partir du niveau 3, quelle que soit la configuration des canaux.

## Le trajet d'un événement

```
agent (ici ou dans un autre dépôt)
  → journal.append()          ← la trace existe avant toute notification
  → niveau + priorité
  → urgent ?  ─ oui ─→ Telegram tout de suite (chat alertes)
              └ non ─→ file d'attente → récapitulatif groupé toutes les 30 min
  → si niveau ≥ 3 : WAITING_APPROVAL, et rien ne bouge
  → carte Telegram avec [ ✅ Approuver ] [ ✖️ Rejeter ]
      (ou, si le bouton n'est pas disponible : /approve <event_id>)
      ├ action de la file plongée → release() : même chemin que le bouton d'une carte agent
      ├ brouillon de contenu → content passe en APPROVED / ABANDONED
      └ événement d'un autre dépôt → décision enregistrée, relue par son API
```

Un tap et un `/approve` tapé à la main tombent dans **le même code** —
`src/app/api/agents/telegram/route.ts` fait juste la conversion bouton → commande
avant d'appeler `runCommand()`. Il n'y a jamais deux chemins qui pourraient
diverger, seulement deux façons d'entrer dans le même.

## Les activités

`DIVING` (ce dépôt), `COCO` (assistant-ai, coco2), `RUGBY` (CSRA), `GLOBAL`
(transverse). La plongée alimente le journal automatiquement ; les autres
poussent leurs événements sur `POST /api/command/events` avec
`COMMAND_INGEST_TOKEN` — aucune lecture croisée de leurs bases, chaque projet
reste maître de ses données.

## Les commandes

| Commande | Effet |
| --- | --- |
| `/today` · `/brief` | priorités, agenda, leads, blocages, opportunités |
| `/report` | bilan : réalisé, chiffres, à suivre, demain |
| `/status [projet]` | événements, blocages, prochaine étape |
| `/tasks` | tout ce qui est ouvert, du P0 au P3 |
| `/approve ID` · `/reject ID [raison]` | la décision, sur l'identifiant exact |
| `/delegate [projet\|rôle] objectif` · `/priority [sujet]` | créer du travail |
| `/kpi [projet] [métrique] [valeur]` | saisir un chiffre que le système ne peut pas connaître |
| `/week` | bilan de la semaine, aussi envoyé le dimanche à 18 h |
| `/focus [projet]` · `/pause [cible]` · `/resume [cible]` | piloter |
| `/audit` | actions, erreurs, validations et niveau A4 des 24 h |

`/pause` suspend les automatisations non critiques — **jamais** les P0 : une
alerte de sécurité qu'on aurait mise en sourdine est le seul échec que ce
système ne peut pas se permettre.

## Les tâches — ce qui doit encore arriver

Le journal dit ce qui s'est passé. Il ne suffisait pas : un événement `PLANNED`
n'a ni objectif mesurable, ni condition de réussite, ni échéance, donc personne
ne peut constater qu'il a été oublié. [`tasks.ts`](../../src/command/tasks.ts)
ferme ce trou.

```
/delegate RUGBY relancer les écoles de Lamai | fini quand 5 brouillons prêts | avant 2026-09-01
  → routing.ts : (RUGBY, sales) → communication
  → tasks.create()   ← refusée si l'objectif tient en un mot ou si « fini quand » manque
  → journal.append() ← la tâche et son événement naissent ensemble, task_id ↔ event_id
  → veille 30 min : échéance < 72 h sans suite écrite → alerte
  → settleTask() → RESULT (ou ERROR) avec sa référence vérifiable
```

Deux refus mécaniques, écrits dans le code plutôt que dans un prompt :

- **une tâche sans condition de fin n'est pas créée** — sans elle, personne ne
  pourrait la clore, et elle pourrirait dans la liste ;
- **un `DONE` sans `reference_url` ni `reference_id` est marqué « non
  vérifié »** — y compris quand l'agent remplit lui-même le champ `impact`, où
  la mention se surajoute au lieu de céder la place.

## Les chiffres

Aucun paiement, aucune réservation et aucune inscription ne transitent par ce
système. Il ne peut donc ni les compter ni les deviner : Cyril les saisit avec
`/kpi`, et **toute métrique non saisie sort `[À COMPLÉTER PAR CYRIL]`, jamais
zéro** — une absence de saisie et un zéro constaté ne disent pas la même chose.

Le jour où une vraie source existe, elle poussera dans la même table par l'API
d'ingestion, sans rien changer aux rapports.

## À qui va une tâche

[`routing.ts`](../../src/command/routing.ts) associe `(activité, catégorie)` à
un agent qui **existe réellement** : les rôles de ce dépôt pour la plongée
(`reception`, `content`, `ops`), les `.claude/agents/` des autres dépôts
ailleurs. Les seize rôles nommés dans le mandat (`growth_director`,
`diving_sales_agent`…) sont des **alias** vers ces agents — `/delegate` les
accepte — et non seize nouveaux fichiers qui dédoubleraient l'équipe.

La catégorie `finance` n'a de titulaire nulle part : aucun agent de Cyril ne
touche à l'argent, et en inventer un router­ait des décisions financières vers
le vide.

## Ce qui est vrai même quand tout est éteint

- Sans Supabase : le journal vit en mémoire du processus et disparaît au
  redéploiement. `persistent: false` le dit dans les réponses de l'API.
- Sans Telegram : les événements s'écrivent quand même, ils sont lus plus tard.
- Sans `COMMAND_INGEST_TOKEN` : l'API répond `401`. Fermée, jamais ouverte.
- Sans tâches branchées : la veille d'échéances ne remonte rien plutôt que de
  bloquer le récapitulatif.
- Le site public n'importe rien de tout ça et se construit sans aucune variable.

Mise en service : [`DEPLOY.md`](./DEPLOY.md), section 5.
