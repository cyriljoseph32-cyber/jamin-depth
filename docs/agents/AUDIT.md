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

**Confirmés depuis, par le propriétaire après revue du site** (accueil, FAQ, Dive Trips, Contact, sitemap) :

| `POLICIES.…` | Valeur |
| --- | --- |
| `requiredDocuments` | Carte de certification (vérification en ligne possible si perdue), logbook si disponible, questionnaire médical complété — à apporter le premier jour |
| `openingHours` | Centre 11 h–18 h tous les jours · WhatsApp répondu 8 h–20 h · ouvert 363 j/an |
| `medicalProtocol` | **Partiel** : questionnaire médical à compléter, et droit de refuser la plongée à toute personne jugée inapte (alcool notamment). Ce que le texte dit explicitement ne pas couvrir : contre-indications précises et certificat médical PADI |
| `staffLanguages` | **anglais, français, thaï, allemand, espagnol, italien, norvégien** — déclarées par le propriétaire |
| `CLOSED_DATES` | 1er janvier et 13 avril (Songkran) — vérifiés à chaque date demandée |

Trois conséquences immédiates dans le code :

- Les **heures calmes** passent de 21 h–8 h à **20 h–8 h**, alignées sur les heures WhatsApp confirmées : une relance qui arrive quand personne ne peut répondre à la réponse qu'elle provoque est pire qu'aucune relance.
- Le **protocole médical partiel** accompagne désormais chaque escalade, en indiquant ce qu'il ne couvre pas. Un protocole partiel qui se présenterait comme complet serait lu comme complet.
- Le **garde-fou des langues** ne bloque plus toute revendication : il vérifie *laquelle*. Les sept langues déclarées passent ; « nous parlons hindi » ou « we speak Japanese » est bloqué. Qu'une phrase soit vraie n'en rend pas une autre vraie, et un plongeur qui réserve en croyant être briefé dans sa langue a été trompé sur ce qui compte le plus sous l'eau.
- Un message dans une langue **parlée mais sans gabarit** (allemand, italien, thaï…) n'est plus traité comme un cul-de-sac. Le système ne répond toujours pas — il n'a de copie approuvée qu'en français et en anglais — mais l'escalade dit « cette langue est parlée dans l'équipe, répondez directement, c'est un avantage à jouer » au lieu de « personne ne la parle ». Sept langues sur un petit centre de plongée à Koh Samui, c'est un argument commercial ; le signaler comme une impasse le gaspillerait.

L'horaire d'ouverture est délibérément **rangé à part de `boatSchedule`** : 11 h est l'heure d'ouverture du centre, pas l'heure de départ du bateau. Les confondre ferait annoncer un départ à 11 h.

**Non confirmés — chaque ligne bloque encore une réponse :**

| `POLICIES.…` | Ce que ça débloque |
| --- | --- |
| `cancellation` | Répondre aux questions d'annulation et de report |
| `deposit` | Annoncer l'acompte dans le récapitulatif |
| `paymentMethods` | Dire comment on paie |
| `meetingPoint` | Le message pré-activité et la liste de la veille |
| `pickupIncluded` | Répondre « transport inclus ? » |
| `boatSchedule` | Annoncer une heure de départ |
| `insurance` | Répondre sur la couverture |
| `minorMinimumAge` | Répondre pour un enfant |

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

**Branchée** : `src/agents/knowledge.ts` charge les 11 questions-réponses des blocs FAQ de
`src/content/fr.ts` et `en.ts` — uniquement celles marquées `confirmed: true` — et l'agent
Réception les cite **mot pour mot** quand elles répondent à la question posée. Rien n'est
reformulé ni traduit : une réponse est la phrase du propriétaire, ou elle n'existe pas.

Deux garde-fous : au moins deux mots-clés doivent correspondre, et la meilleure correspondance
doit devancer la suivante — une égalité signifie que le message est ambigu, et un message ambigu
part à un humain plutôt que de recevoir une réponse assurée à une question qui n'a pas été posée.
Un test vérifie par ailleurs que **chaque** réponse FAQ passe le garde-fou de sortie : si une
promesse se glisse un jour dans la FAQ du site, elle échoue ici avant d'atteindre un client.

Réutilisée telle quelle, sans rien réécrire :

- `src/content/site.ts` — téléphone, réseaux, zone, partenaire. Seuls faits de contact autorisés.
- Les FAQ de `src/content/fr.ts` et `en.ts`, déjà marquées `confirmed: true/false` — même
  discipline que `Verified<T>`. Le message pré-activité reprend de là ce qu'il faut apporter.
- Le prompt de `src/lib/assistant.ts` — source des règles « ne jamais inventer » et des tarifs.

**`TODO` :** les vrais messages WhatsApp, e-mails et avis clients n'ont pas été fournis. Ils
constitueraient une base de connaissance bien meilleure que des gabarits — notamment pour les
objections réelles et le vocabulaire des clients.

### Pistes trouvées en ligne — à vérifier, **non opérantes**

Le propriétaire a demandé de prendre ces informations sur `discoverydivers.com`. Le domaine est
inaccessible depuis l'environnement de développement (403 au tunnel du proxy, confirmé deux fois,
sur `WebFetch` comme sur `curl`). La recherche web a en revanche fait remonter les éléments
ci-dessous.

**Ils ne sont pas repris dans `config.ts`, et c'est délibéré :** ils proviennent de
**revendeurs** (GetYourGuide, Viator, blogs de voyage), pas du centre. La politique d'annulation
d'un revendeur est celle du revendeur — pas celle de Discovery Divers, et encore moins celle de
Jammin's Depths. Les inscrire comme vérifiées les ferait citer à un client comme nos conditions.

| Piste | Source | Ce qu'il faut confirmer |
| --- | --- | --- |
| « Annulation gratuite jusqu'à 24 h avant, réservation sans paiement immédiat » | GetYourGuide / Viator | Est-ce la politique du centre, ou seulement celle de la plateforme ? Et quelle est la nôtre ? |
| « Divers assurés via le programme PADI Asia Pacific » | pages revendeurs | À confirmer auprès du centre, et préciser ce qui est couvert |
| « Membre du réseau de caissons SSS » | pages revendeurs | Fait vérifiable, utile en cas d'incident — à confirmer |
| « Savoir nager, déclarer toute condition médicale avant réservation » | pages revendeurs | Formulation exacte de l'exigence, et **qui décide** de l'aptitude |
| Horaires d'ouverture du centre | 10 h–21 h *et* 11 h–18 h selon les pages | Deux valeurs contradictoires sur le même domaine — inutilisable en l'état |

La page qui ferait autorité est `discoverydivers.com/faqs/`. Deux façons de débloquer :
copiez-collez son contenu (je remplis `config.ts` en une passe), ou approuvez le message de
questions que le rapport hebdomadaire prépare déjà pour le centre.

## Ce qu'il reste à faire, par ordre d'utilité

1. **Renseigner les approbateurs** (question 4). Une ligne dans `config.ts`.
2. **Compléter le protocole médical** : contre-indications précises et certificat médical PADI —
   la seule partie sécurité encore ouverte.
3. **Confirmer point de rendez-vous, horaires de départ, transport** avec Discovery Divers.
   Débloque le message pré-activité et la liste de la veille.
4. **Politique d'annulation, acompte, moyens de paiement.** Les questions les plus fréquentes.
5. **Âge minimum et assurance.**
6. **Confirmer l'adresse e-mail** ou renoncer au canal.
7. **Fournir de vrais échanges clients** pour enrichir la base de connaissance au-delà de la FAQ.
8. *(optionnel)* **Copie approuvée en allemand, espagnol, italien, thaï, norvégien** si vous voulez
   que le système réponde lui-même dans ces langues. Je ne ferai pas traduire les gabarits par un
   modèle : ils portent des formulations de sécurité, et une nuance perdue sur « savoir nager » ou
   sur un point médical ne se rattrape pas.
