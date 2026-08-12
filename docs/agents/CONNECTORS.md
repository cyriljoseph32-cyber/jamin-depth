# Checklist de connexion

> **Le code est écrit pour Supabase, WhatsApp Cloud API et Telegram** — il ne reste que les
> variables d'environnement à renseigner. La procédure pas à pas est dans
> [`DEPLOY.md`](./DEPLOY.md) ; cette page explique ce que chaque connexion débloque et ce
> qu'elle ne débloque pas.

Aucun accès n'a été inventé. Un port sans identifiants retombe sur son mock, annonce
`status: "missing"`, et le rapport hebdomadaire le liste tant qu'il l'est.

---

## 1. WhatsApp — priorité 1

Canal principal (+66 63 375 3316). Deux mondes très différents :

**WhatsApp Business App** (l'application sur le téléphone)
Pas d'API. Le système ne peut ni lire ni envoyer. Les brouillons doivent être copiés à la main
depuis la file de validation. C'est déjà utile — la rédaction et la qualification sont le gros
du travail — mais rien n'est automatique.

**WhatsApp Cloud API** (Meta) — **implémenté**
Webhook : `/api/agents/whatsapp`, signature `X-Hub-Signature-256` vérifiée en temps constant.
Envoi : API Graph. Variables : `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
`WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`.

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

## 4 bis. Telegram — la validation — **implémenté**

Webhook : `/api/agents/telegram`. Chaque action en attente arrive en carte avec deux boutons ;
`TELEGRAM_ALLOWED_CHAT_IDS` décide qui peut valider. Voir [`DEPLOY.md`](./DEPLOY.md).

## 5. Agenda — Google Calendar

À fournir : un compte de service ou OAuth, l'identifiant du calendrier des sorties.

Débloque l'écriture des événements — **après** validation humaine (`rule:calendar-write`), et la
liste de la veille lue depuis le vrai calendrier plutôt que depuis le CRM.

## 6. Base de données — Supabase — **implémenté**

Schéma : [`supabase/schema.sql`](../../supabase/schema.sql) (tables `leads`, `queue_items`,
`audit_log`, `processed_events`). Accès par PostgREST et `fetch`, sans dépendance ajoutée.
Variables : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

Débloque la persistance — c'est ce qui transforme la bibliothèque en système exploitable au
quotidien. Sans elle, prospects et file de validation vivent en mémoire et disparaissent au
redéploiement.

## 7. Modèle de langage — optionnel

`ANTHROPIC_API_KEY` est déjà utilisée par l'assistant du site. Les agents fonctionnent
**entièrement sans** : le modèle ne sert qu'à reformuler un brouillon déjà validé, un appel
maximum par événement, et sa sortie repasse par le garde-fou.

---

## Ordre recommandé

1. **Supabase** — sans persistance, tout le reste s'évapore au redémarrage.
2. **WhatsApp Cloud API** — le canal qui porte le volume.
3. **Telegram** — sinon les actions s'accumulent en file sans que personne soit prévenu.
4. **Vercel Cron** (`CRON_SECRET`) — relances, brief de la veille, rapport hebdo.
5. **Meta API** — Instagram et Facebook (le webhook reste à écrire).
6. **Google Calendar** — planification.
7. **Google Business Profile** — avis.
8. **E-mail** — après confirmation de l'adresse.

## Ce qui ne dépend d'aucune connexion

Les `POLICIES` encore non confirmées (voir [`AUDIT.md`](./AUDIT.md) pour la liste à jour) ne
demandent aucun accès technique : seulement des réponses. Cinq ont été comblées depuis l'audit
initial — documents, horaires d'ouverture, jours de fermeture, langues parlées, protocole médical
(partiel). Il reste l'annulation, l'acompte, les moyens de paiement, le point de rendez-vous, les
horaires de départ, le transport, l'assurance et l'âge minimum — et elles bloquent toujours plus
de messages que l'absence d'API.
