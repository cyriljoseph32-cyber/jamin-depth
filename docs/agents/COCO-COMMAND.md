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
   rien ne part sans un `/approve` portant l'identifiant exact.
3. **Le fondateur n'est dérangé que quand c'est nécessaire.** Urgences et
   validations partent seules ; le reste attend le récapitulatif de 30 minutes.

## Les niveaux

| Niveau | Ce que c'est | Ce qui se passe |
| --- | --- | --- |
| 0 — observer | lire, classer, analyser | exécuté, journalisé |
| 1 — préparer | brouillon, plan, proposition | exécuté, remonte dans le bilan |
| 2 — réversible | écriture interne, planification non publique | exécuté et notifié |
| 3 — externe/sensible | envoyer, publier, modifier un dossier client | **attend `/approve`** |
| 4 — critique | paiement, contrat, accès, incident | **s'arrête et alerte** |

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
  → /approve <event_id>
      ├ action de la file plongée → release() : même chemin que le bouton ✅
      └ événement d'un autre dépôt → décision enregistrée, relue par son API
```

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
| `/delegate [projet] tâche` · `/priority [sujet]` | créer du travail |
| `/focus [projet]` · `/pause [cible]` · `/resume [cible]` | piloter |
| `/audit` | actions, erreurs, validations et niveau 4 des 24 h |

`/pause` suspend les automatisations non critiques — **jamais** les P0 : une
alerte de sécurité qu'on aurait mise en sourdine est le seul échec que ce
système ne peut pas se permettre.

## Ce qui est vrai même quand tout est éteint

- Sans Supabase : le journal vit en mémoire du processus et disparaît au
  redéploiement. `persistent: false` le dit dans les réponses de l'API.
- Sans Telegram : les événements s'écrivent quand même, ils sont lus plus tard.
- Sans `COMMAND_INGEST_TOKEN` : l'API répond `401`. Fermée, jamais ouverte.
- Le site public n'importe rien de tout ça et se construit sans aucune variable.

Mise en service : [`DEPLOY.md`](./DEPLOY.md), section 5.
