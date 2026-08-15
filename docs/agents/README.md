# Système d'agents — Jammin's Depths

Automatisation du travail qui suit le clic : qualifier une demande, préparer une sortie,
relancer, rappeler les documents, consigner, rendre compte. Construit pour un centre de
plongée à Koh Samui, pas pour « une entreprise ».

Le code vit dans [`src/agents/`](../../src/agents), et tourne pour de vrai : les messages
WhatsApp entrent par webhook, l'état est dans Supabase, et chaque action à valider arrive sur
Telegram avec deux boutons. Trois tâches planifiées font le reste (relances, brief de la veille,
rapport hebdo). Aucune dépendance npm ajoutée ; le site public est inchangé et n'importe rien
de tout ça.

**Pour mettre en service : [`DEPLOY.md`](./DEPLOY.md)** — dix variables à coller dans Vercel et
un fichier SQL à exécuter.

## Ce que le système ne fera jamais seul

Ces refus sont dans le code, pas dans une note d'intention. Ils sont testés.

| Jamais sans validation humaine | Où c'est verrouillé |
| --- | --- |
| Confirmer une place | `policy.ts` → `rule:booking-confirmation` + `rule:unverified-availability` |
| Encaisser, rembourser, envoyer un lien de paiement | `rule:payment`, `rule:refund` |
| Modifier ou annuler une réservation | `rule:booking-change` |
| Écrire dans l'agenda | `rule:calendar-write` |
| Publier un contenu | `rule:publication` |
| Répondre à un avis | `rule:review-reply` |
| Déclarer un incident | `rule:incident` |
| S'engager auprès d'un fournisseur | `rule:external-commitment` |
| Donner un avis médical ou juger l'aptitude à plonger | `HARD_STOP_TOPICS` + `guard:medical-advice` |
| Promettre météo, faune, délai, tarif hors catalogue, place | `auditDraft()` |
| Répondre dans une langue non confirmée côté équipe | `rule:foreign-language` |

En face, ce qui part sans attendre : l'enregistrement du prospect, la note interne, et
**l'alerte au responsable**. Faire valider une alerte de sécurité reviendrait à ralentir
l'alerte elle-même.

## Le chemin d'un message

```
WhatsApp Cloud API ──▶ /api/agents/whatsapp (signature HMAC vérifiée)
Instagram · Facebook · formulaire · chat · interne ──▶ (mêmes ports, webhook à écrire)
        │
        ▼
  language.ts + extract.ts + policy.ts        ← règles seules, zéro token
        │   LeadSignals : langue, activité, dates, participants, niveau,
        │   sujets sensibles, questions sans réponse vérifiée
        ▼
  orchestrator.ts    classe → dédoublonne → priorise (P0…P3) → route
        │
        ├─ reception    qualifie, répond vite, 2 questions maximum, relance ≤ 2 fois
        ├─ booking      récap + demande au centre partenaire + liste opérationnelle J+1
        ├─ safety       infos pré-activité approuvées, documents, escalade médicale P0
        ├─ content      briefs et brouillons FR puis EN (publication = validation)
        ├─ reputation   brouillon de réponse aux avis (négatif = propriétaire)
        └─ ops          tâches internes, fournisseurs, rapport hebdomadaire
        │
        ▼
  deux garde-fous indépendants
     1. matrice par type d'action      (policy.ts → requiresHumanApproval)
     2. relecture des mots du message  (policy.ts → auditDraft)
        │
        ├── l'un des deux objecte → file de validation → carte Telegram (2 boutons)
        │                                                        │
        │                                              Approuver ▼
        └── les deux passent ──────────────────────────▶ execute.ts ──▶ envoi WhatsApp
        │
        ▼
  audit.ts   journal : received → classified → routed → proposed →
             queued | blocked | executed | escalated        (persisté dans Supabase)

  Vercel Cron : relances (horaire) · brief J+1 (19 h) · rapport hebdo (lundi 8 h)
```

Un point de conception qui vaut d'être dit : **une action approuvée emprunte exactement le même
chemin** qu'une action jamais soumise (`execute.ts`). Deux chemins finiraient par diverger, et
celui qui aurait dérivé serait celui qui porte un message approuvé à un client. Le garde-fou est
d'ailleurs **rejoué à l'envoi** : un brouillon peut avoir attendu des heures dans la file.

Un agent ne fait que **proposer**. Seul l'orchestrateur décide de ce qui sort, et il ne peut
pas être configuré pour contourner les deux garde-fous à la fois.

## Trois choix qui expliquent le reste

**1. Le déterministe d'abord.** Langue, dates, nombre de personnes, niveau, intention et sujets
sensibles sont détectés par règles. Un message normal coûte donc **zéro token**. Ce n'est pas
qu'une question de facture : une règle qui ne sait pas lire « on vient bientôt » laisse le champ
vide, là où un modèle invente volontiers le 15 mars. Une date devinée finit sur un vrai bateau
avec de vraies personnes. Les formulations non résolues sont conservées telles quelles dans
`vagueDates`, pour lecture humaine.

Le modèle n'intervient qu'à un seul endroit (`llm.ts`) : reformuler un brouillon déjà fondé et
déjà validé — un appel maximum par événement, et la sortie repasse par `auditDraft()`. Si la
reformulation introduit une promesse, le texte du modèle est jeté et le gabarit conservé. Sans
clé API, tout fonctionne.

**2. `TODO` est un type, pas un commentaire.** Chaque fait métier non confirmé est
`Verified<T> = T | "TODO"`. On ne peut pas le glisser dans une phrase : il faut le lire via
`verified()` et traiter le `null`, ou passer par `requireVerified()` qui l'inscrit dans les
lacunes de la réponse. Conséquence visible : le récapitulatif affiche « Point de rendez-vous :
à confirmer » au lieu d'inventer une plage, et le rapport hebdomadaire liste chaque `TODO`
restant jusqu'à ce qu'il soit comblé.

**3. Le système ne peut pas connaître les disponibilités.** Les places sont détenues par
Discovery Divers et libérées par un humain qui lit un message (`AVAILABILITY.source =
"partner_message"`). L'adaptateur correspondant répond donc toujours `unknown` — ce n'est pas
un bouchon à remplir plus tard, c'est la vérité. L'agent Réservation fait le travail de part et
d'autre du « oui » : un récapitulatif assez complet pour que le centre réponde en une fois, et
la confirmation préparée pour qu'un humain n'ait qu'un geste à faire.

## Prise en main

```ts
import { createOrchestrator } from "@/agents";

const bus = createOrchestrator();          // mocks en mémoire par défaut
const run = await bus.handle(event);       // un événement entrant

bus.queue.pending();                       // ce qu'un humain doit regarder, P0 d'abord
bus.log.format();                          // pourquoi le système a décidé ça
run.blocked;                               // brouillons refusés par le garde-fou
run.outcome?.gaps;                         // faits que le système a refusé d'affirmer
```

Fonctions déclenchées par le calendrier plutôt que par un message :

```ts
nextDayBrief({ date, now, leads, pending });   // la liste de la veille au soir
preArrivalMessage({ lead, date });             // infos pré-activité approuvées
documentsReminder({ lead, date });             // rappel documents
weeklyReport({ now, weekStart, leads, queue, ports });
```

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `config.ts` | Résultat de l'audit. **Le seul fichier à éditer** quand l'activité change. |
| `catalog.ts` | Les seuls tarifs qu'un agent peut citer. Le reste est `TODO`. |
| `policy.ts` | Matrice de validation, sujets sensibles, garde-fou des brouillons. |
| `language.ts` | FR / EN, et détection d'une langue non servie. |
| `extract.ts` | Dates, participants, niveau, activité, questions sans réponse vérifiée. |
| `regex.ts` | Frontières de mots Unicode — `\b` de JS ignore les accents (voir plus bas). |
| `templates.ts` | Messages approuvés FR/EN, à trous, qui refusent de rendre incomplet. |
| `orchestrator.ts` | Classement, dédoublonnage, routage, application des garde-fous. |
| `queue.ts` | File de validation humaine. Aucune auto-approbation, aucun délai qui libère. |
| `audit.ts` | Journal lisible. |
| `llm.ts` | Le seul endroit où un modèle agit, sous budget. |
| `execute.ts` | Le seul endroit où une action devient un effet réel. |
| `runtime.ts` | Le seul endroit où les variables d'environnement sont lues. |
| `schedule.ts` | Le travail à heure fixe : relances, brief, rapport. |
| `adapters/` | Ports + implémentations : `supabase.ts`, `whatsapp.ts`, `telegram.ts`, et les mocks. |
| `roles/` | Les six agents spécialisés. |

Côté application : `src/app/api/agents/{whatsapp,telegram,cron/[job]}/route.ts` — trois routes,
toutes authentifiées (signature Meta, secret Telegram + liste des comptes autorisés, `CRON_SECRET`).

## Une note technique qui a des conséquences métier

`\b` en JavaScript est défini sur l'ASCII : une lettre accentuée compte comme un caractère
**non** alphabétique. Concrètement, `/\bcertifi[ée]\b/` ne reconnaît pas « certifié »,
`/\b[ée]pileps\w*\b/` ne reconnaît pas « épilepsie », et un garde-fou écrit
`/c'est\s+confirm[ée]\b/` laisse passer « c'est confirmé » vers un client. Dans un système
francophone chargé de repérer des signaux médicaux, ce détail est un défaut de sécurité.

`regex.ts` fournit `words()`, qui construit de vraies frontières Unicode. Tous les motifs de
`policy.ts` et `extract.ts` passent par là, et `policy.test.ts` verrouille précisément ces mots.

## Documents voisins

- [`AUDIT.md`](./AUDIT.md) — les questions de la phase 0, les réponses obtenues, ce qui manque.
- [`CONNECTORS.md`](./CONNECTORS.md) — checklist de connexion, et ce que chaque accès débloque.
- [`RUNBOOK.md`](./RUNBOOK.md) — utiliser la file de validation au quotidien.
