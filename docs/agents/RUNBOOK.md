# Mode d'emploi — la file de validation

Le système prépare, vous décidez. Cette page décrit ce que vous voyez et ce qu'on attend de vous.

## Lire la file

```ts
bus.queue.pending();     // tout ce qui attend, P0 d'abord, puis le plus ancien
bus.queue.pending("owner");
formatPending(bus.queue); // une ligne par action, lisible
```

Une ligne se lit ainsi :

```
P1 · q-4 · send_message — Récap client FR — place non garantie [rule:channel-draft-only]
▲     ▲      ▲             ▲                                     ▲
│     │      │             │                                     └ pourquoi ça vous est soumis
│     │      │             └ ce que ça fait, en une ligne
│     │      └ le type d'action
│     └ l'identifiant à approuver
└ l'urgence
```

## Décider

```ts
bus.queue.approve("q-4", "votre-nom");
bus.queue.reject("q-4", "votre-nom", "on est complet ce jour-là");
```

Trois règles :

- **Rien ne s'approuve tout seul.** Aucun délai ne libère une action. Une action ignorée reste
  en attente, indéfiniment.
- **On ne décide qu'une fois.** Une seconde décision sur la même action est refusée, pas
  appliquée silencieusement.
- **L'urgence change l'ordre, jamais la règle.** Un P0 passe devant ; il ne se dispense pas de vous.

## Les priorités

| Niveau | Ce que c'est | Objectif interne |
| --- | --- | --- |
| **P0** | Santé, sécurité, incident. Un humain, maintenant. | 15 min |
| **P1** | Sortie proche, avis négatif, négociation, langue non servie. | 1 h |
| **P2** | Prospect normal. | 4 h |
| **P3** | Contenu, rapports, back-office. | 24 h |

Ces objectifs sont **internes** : ils ne sont jamais annoncés à un client, et le garde-fou
refuse tout message qui promettrait un délai de réponse.

## Les raisons que vous verrez

| Raison | Traduction |
| --- | --- |
| `rule:channel-draft-only` | Canal en rédaction seule — relisez et envoyez vous-même. |
| `rule:unverified-availability` | Personne n'a confirmé la place. Attendez la réponse du centre. |
| `rule:booking-confirmation` | Confirmation de place : à vous. |
| `rule:payment` / `rule:refund` | Argent. Jamais automatique. |
| `rule:safety-topic` | Signal santé/sécurité. Aucun avis n'a été donné. |
| `rule:sensitive-topic` | Plainte, négociation, légal, mineur. |
| `rule:foreign-language` | Message dans une langue non confirmée côté équipe. |
| `rule:unverified-fact` | Le client demande quelque chose que la config ne sait pas. |
| `rule:review-reply` / `rule:publication` | Parole publique. |
| `rule:external-commitment` | Message à un fournisseur. |
| `guard:*` | Le brouillon **disait** quelque chose d'interdit. Voir ci-dessous. |

## Un `guard:` dans la liste

Cela veut dire que le garde-fou a relu le texte et y a trouvé une promesse interdite : une place
confirmée, la météo, une espèce, un délai, un tarif hors catalogue, un jugement d'aptitude, une
langue parlée non confirmée.

L'action n'est pas adoucie automatiquement — elle vous est soumise telle quelle, avec l'extrait
fautif. **Corrigez le texte avant d'envoyer, ou rejetez.** Si un gabarit produit
systématiquement un `guard:`, c'est le gabarit qu'il faut corriger dans `templates.ts` (le test
`templates.test.ts` échouera d'ailleurs).

## Les cas santé (P0)

Ce que le système a fait, et rien de plus :

1. Enregistré le signalement sur le prospect.
2. Préparé un accusé de réception **empathique et sans engagement** — il dit que le point est
   médical, qu'il est transmis, et que rien n'est réservé.
3. Vous a alerté immédiatement, avec l'extrait du message.
4. Signalé, s'il y a lieu, que `POLICIES.medicalProtocol` n'est pas défini.

Ce qu'il n'a pas fait, et ne fera pas : donner un avis, rassurer sur une contre-indication,
juger l'aptitude à plonger, ou laisser entendre qu'une place est retenue.

## La veille au soir

```ts
nextDayBrief({ date: "2026-03-12", now, leads: ports.crm.all(), pending: bus.queue.pending() });
```

Vous obtenez : les clients attendus, leur niveau, leur langue, les alertes, les documents à
vérifier, ce qui reste à valider — et **explicitement** ce qui n'est pas confirmé (point de
rendez-vous, horaires, transport). Ces lignes-là sont le cœur du brief : mieux vaut les voir à
19 h que sur le ponton à 7 h 30.

## Chaque semaine

```ts
weeklyReport({ now, weekStart, leads: ports.crm.all(), queue: bus.queue.all(), ports });
```

Prospects par canal, étapes, actions en attente, dossiers sensibles, connexions manquantes, et la
liste des informations non confirmées qui coûtent des réponses. Cette dernière liste ne
disparaîtra qu'en remplissant `config.ts` — c'est voulu.

## Quand quelque chose vous surprend

```ts
bus.log.forEvent("evt-12");   // le fil de décision d'un message
bus.log.format();             // tout le journal
```

Chaque ligne nomme l'étape et la règle. Une réponse discutable se remonte toujours à la règle
qui l'a autorisée — et cette règle est modifiable dans `policy.ts` ou `config.ts`, avec un test
en face.
