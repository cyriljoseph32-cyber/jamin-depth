# Checklist de connexion

Aucun accès n'a été inventé. Chaque port de [`src/agents/adapters/`](../../src/agents/adapters)
annonce `status: "missing"` et tourne sur un mock en mémoire ; le rapport hebdomadaire les liste
tant qu'ils le sont.

Cette page dit, pour chaque connexion : ce qu'il faut fournir, ce que ça débloque, et ce que ça
**ne** débloque pas.

---

## 1. WhatsApp — priorité 1

Canal principal (+66 63 375 3316). Deux mondes très différents :

**WhatsApp Business App** (l'application sur le téléphone)
Pas d'API. Le système ne peut ni lire ni envoyer. Les brouillons doivent être copiés à la main
depuis la file de validation. C'est déjà utile — la rédaction et la qualification sont le gros
du travail — mais rien n'est automatique.

**WhatsApp Cloud API** (Meta)
À fournir : un compte Meta Business vérifié, un numéro dédié à l'API (⚠️ un numéro migré vers
l'API ne fonctionne plus dans l'application), un `WHATSAPP_TOKEN`, un `PHONE_NUMBER_ID`, une URL
de webhook et un `WEBHOOK_VERIFY_TOKEN`.

Débloque : réception automatique des messages, envoi des réponses approuvées, et la possibilité
de passer `CHANNELS.whatsapp.automation` de `draft_only` à `auto_reply`.
Ne débloque pas : les disponibilités, qui restent chez le centre partenaire.

À noter : hors fenêtre de 24 h, Meta n'autorise que des gabarits pré-approuvés. Les modèles de
`templates.ts` sont écrits court et sans variable superflue en partie pour cette raison.

## 2. Meta API — Instagram et Facebook

À fournir : page Facebook liée à un compte Instagram professionnel, application Meta avec les
permissions `instagram_manage_messages` / `pages_messaging`, jeton de page longue durée, webhook.

Débloque : réception et réponse sur les deux canaux (aujourd'hui `draft_only`).

## 3. E-mail — bloqué en amont

`SITE.email` (`contact@jamminsdepths.com`) est un **placeholder**. Rien à connecter avant de
confirmer ou remplacer cette adresse. Le canal est `enabled: false`, et le mock de messagerie
refuse tout envoi dessus — c'est volontaire.

Une fois l'adresse confirmée : IMAP/SMTP ou l'API du fournisseur. Débloque le canal e-mail et le
repli `mailto:` des formulaires du site.

## 4. Google Business Profile — avis

À fournir : profil revendiqué et vérifié, accès à l'API Business Profile (validation Google
requise, comptez plusieurs jours).

Débloque l'agent Réputation en réel. Rappel : une réponse à un avis **négatif** reste en file de
validation quoi qu'il arrive, et le brouillon ne propose jamais de geste commercial.

## 5. Agenda — Google Calendar

À fournir : un compte de service ou OAuth, l'identifiant du calendrier des sorties.

Débloque l'écriture des événements — **après** validation humaine (`rule:calendar-write`), et la
liste de la veille lue depuis le vrai calendrier plutôt que depuis le CRM.

## 6. CRM / base de données — Supabase, Notion ou tableur

À fournir : le choix de l'outil, puis les accès correspondants.

Débloque la persistance : aujourd'hui les prospects et la file de validation vivent en mémoire
et disparaissent à l'arrêt du processus. C'est la connexion qui transforme la bibliothèque en
système exploitable au quotidien.

Le port `CrmPort` est déjà l'interface à implémenter ; aucun agent ne change.

## 7. Modèle de langage — optionnel

`ANTHROPIC_API_KEY` est déjà utilisée par l'assistant du site. Les agents fonctionnent
**entièrement sans** : le modèle ne sert qu'à reformuler un brouillon déjà validé, un appel
maximum par événement, et sa sortie repasse par le garde-fou.

---

## Ordre recommandé

1. **CRM / base** — sans persistance, tout le reste s'évapore au redémarrage.
2. **WhatsApp Cloud API** — le canal qui porte le volume.
3. **Meta API** — Instagram et Facebook.
4. **Google Calendar** — planification.
5. **Google Business Profile** — avis.
6. **E-mail** — après confirmation de l'adresse.

## Ce qui ne dépend d'aucune connexion

Les onze `POLICIES` non confirmées (voir [`AUDIT.md`](./AUDIT.md)) ne demandent aucun accès
technique : seulement des réponses. Elles bloquent aujourd'hui plus de messages que l'absence
d'API.
