# Phase 0 — audit avant construction

Ce que l'on sait, ce que l'on a décidé, ce qui manque encore. Les réponses ci-dessous sont
celles du propriétaire ; tout le reste est marqué `TODO` dans
[`src/agents/config.ts`](../../src/agents/config.ts) et remonte automatiquement dans le rapport
hebdomadaire jusqu'à être comblé.

## Les sept questions

### 1. Quels canaux sont réellement utilisés ?

**Réponse : WhatsApp, Instagram et Facebook (messages privés).**

| Canal | État | Automatisation actuelle |
| --- | --- | --- |
| WhatsApp (+66 63 375 3316) | actif, canal principal | `draft_only` — le système rédige, un humain envoie |
| Instagram (@granola51) | actif | `draft_only` |
| Facebook (page Underwatersamuirecovery) | actif | `draft_only` |
| Formulaire du site | actif | `draft_only` (aujourd'hui : lien `wa.me` pré-rempli) |
| Chat du site | actif | `auto_reply` — assistant déjà en place, déjà bridé |
| E-mail | **inactif** | `SITE.email` est encore un placeholder |
| Google Business Profile | **inactif** | profil non confirmé comme géré |
| Téléphone | actif | humain uniquement, le système n'appelle personne |

`TODO` : WhatsApp Business App (manuel) ou WhatsApp Cloud API (automatisable) ? La réponse
décide si l'on peut passer un jour de `draft_only` à `auto_reply`.

### 2. Où sont stockées réservations, prospects, plannings et disponibilités ?

**Réponse : chez Discovery Divers, par message.** Aucun système de référence connecté côté
Jammin's Depths.

C'est la décision la plus structurante du projet. Elle interdit au système de confirmer une
place — non par prudence excessive, mais parce qu'aucune donnée ne le lui permet. Voir
`AVAILABILITY.canSystemHold = false`.

Les prospects sont désormais centralisés dans le CRM de la bibliothèque (mock en mémoire), avec
une clé unique par personne : quelqu'un qui écrit sur Instagram puis sur WhatsApp depuis le même
numéro est un seul prospect, pas deux réponses différentes.

### 3. Quelles offres, tarifs, politiques et conditions sont vérifiés ?

**Vérifiés** (déjà publiés sur le site, tarifs Discovery Divers, par personne, susceptibles
d'évoluer) — ce sont les seuls chiffres qu'un agent peut citer :

| Offre | À partir de |
| --- | --- |
| Baptême — Discover Scuba Diving (1 journée) | ฿5,850 |
| PADI Open Water (3–4 jours) | ฿17,900 |
| PADI Advanced Open Water (2 jours) | ฿13,900 |
| Sail Rock | ฿4,550 |
| Koh Tao (2 plongées) | ฿4,850 |
| Chumphon Pinnacle | ฿5,050 |
| Snorkeling | ฿2,450 |

**Non confirmés — chaque ligne bloque aujourd'hui une réponse :**

| `POLICIES.…` | Ce que ça débloque |
| --- | --- |
| `cancellation` | Répondre aux questions d'annulation et de report |
| `deposit` | Annoncer l'acompte dans le récapitulatif |
| `paymentMethods` | Dire comment on paie |
| `meetingPoint` | Le message pré-activité et la liste de la veille |
| `pickupIncluded` | Répondre « transport inclus ? » |
| `boatSchedule` | Annoncer une heure de départ |
| `staffLanguages` | Écrire « nous parlons… » — bloqué tant que ce n'est pas confirmé |
| `insurance` | Répondre sur la couverture |
| `minorMinimumAge` | Répondre pour un enfant |
| `medicalProtocol` | Tout cas santé part au propriétaire brut, sans protocole écrit |
| `requiredDocuments` | Rappeler les documents et décharges |

Spécialités PADI, groupes privés et récupération sous-marine restent sans tarif : devis au cas
par cas, jamais chiffré par un agent.

### 4. Qui a le droit de valider les actions sensibles ?

**`TODO`.** Trois rôles existent (`owner`, `instructor`, `ops`) avec leurs périmètres, mais les
noms et moyens de contact ne sont pas renseignés. Par défaut, **tout remonte au propriétaire** —
c'est volontairement le comportement le plus sûr, pas un oubli.

### 5. Quels outils sont connectés ?

Aucun, côté agents. Chaque port annonce `status: "missing"` et fonctionne sur un mock en
mémoire. Rien n'est simulé silencieusement : voir [`CONNECTORS.md`](./CONNECTORS.md).

### 6. Structure du site Vercel et du dépôt GitHub

Connue et inchangée : Next.js 15 (App Router), React 19, TypeScript strict, FR/EN avec slugs
localisés (`src/content/routes.ts`), assistant de chat en `src/app/api/chat/route.ts`. Les
agents sont ajoutés à côté, dans `src/agents/`, et le site n'en importe rien.

### 7. Quelle base de connaissance réelle existe déjà ?

Réutilisée telle quelle, sans rien réécrire :

- `src/content/site.ts` — téléphone, réseaux, zone, partenaire. Seuls faits de contact autorisés.
- Les FAQ de `src/content/fr.ts` et `en.ts`, déjà marquées `confirmed: true/false` — même
  discipline que `Verified<T>`. Le message pré-activité reprend de là ce qu'il faut apporter.
- Le prompt de `src/lib/assistant.ts` — source des règles « ne jamais inventer » et des tarifs.

**`TODO` :** les vrais messages WhatsApp, e-mails et avis clients n'ont pas été fournis. Ils
constitueraient une base de connaissance bien meilleure que des gabarits — notamment pour les
objections réelles et le vocabulaire des clients.

## Ce qu'il reste à faire, par ordre d'utilité

1. **Renseigner les approbateurs** (question 4). Une ligne dans `config.ts`.
2. **Écrire le protocole médical** (`medicalProtocol`) et **la liste des documents**
   (`requiredDocuments`). Ce sont les deux `TODO` qui touchent la sécurité.
3. **Confirmer point de rendez-vous, horaires, transport** avec Discovery Divers. Débloque le
   message pré-activité et la liste de la veille.
4. **Politique d'annulation, acompte, moyens de paiement.** Les questions les plus fréquentes.
5. **Confirmer l'adresse e-mail** ou renoncer au canal.
6. **Trancher WhatsApp App / Cloud API.** Condition de toute réponse automatique.
7. **Fournir de vrais échanges clients** pour la base de connaissance.
