# Mise en service

Quatre branchements, dans cet ordre. Chacun fonctionne sans les autres : le
déploiement ne casse jamais parce qu'une variable manque, il fait simplement moins.

Aucun secret n'est écrit dans le dépôt. Tout ce qui suit se colle dans
**Vercel → Settings → Environment Variables** (Production *et* Preview), puis se
redéploie.

---

## 1. Supabase — la persistance

Sans elle, prospects et file de validation disparaissent à chaque redéploiement.
C'est donc la première étape.

1. Créez un projet sur [supabase.com](https://supabase.com) (l'offre gratuite suffit).
2. **SQL Editor → New query**, collez le contenu de
   [`supabase/schema.sql`](../../supabase/schema.sql), exécutez. Le script est
   ré-exécutable sans risque.
3. **Project Settings → API**, relevez :

| Variable Vercel | Où la trouver |
| --- | --- |
| `SUPABASE_URL` | « Project URL » |
| `SUPABASE_SERVICE_ROLE_KEY` | « service_role », section Project API keys |

⚠️ La clé `service_role` contourne toute sécurité de ligne. Elle ne doit jamais
être préfixée `NEXT_PUBLIC_`, ni apparaître côté navigateur. Le schéma active
RLS sans aucune règle : sans cette clé, personne ne lit ces tables — ce qui est
voulu, elles contiennent des coordonnées client et des mentions de santé.

**Vérifier** : après redéploiement, envoyez-vous un message de test (étape 2) et
regardez la table `leads` se remplir dans **Table Editor**.

---

## 2. WhatsApp Cloud API — la réception

Vous m'avez indiqué que l'API est déjà configurée. Il reste à relier le webhook.

Dans [developers.facebook.com](https://developers.facebook.com) → votre app :

| Variable Vercel | Où la trouver |
| --- | --- |
| `WHATSAPP_TOKEN` | WhatsApp → API Setup → jeton permanent (via un utilisateur système) |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp → API Setup → « Phone number ID » |
| `WHATSAPP_APP_SECRET` | App Settings → Basic → « App secret » |
| `WHATSAPP_VERIFY_TOKEN` | **Vous l'inventez** — une longue chaîne aléatoire |

Puis **WhatsApp → Configuration → Webhook → Edit** :

- **Callback URL** : `https://<votre-domaine>/api/agents/whatsapp`
- **Verify token** : la même chaîne que `WHATSAPP_VERIFY_TOKEN`
- Enregistrez : Meta appelle l'URL en `GET` et attend le défi. Un échec ici
  signifie presque toujours que la variable n'est pas encore déployée.
- **Webhook fields** : abonnez-vous à **`messages`** (et à rien d'autre, le reste
  est du bruit).

Le jeton temporaire de l'onglet API Setup expire en 24 h ; utilisez un jeton
d'utilisateur système pour la production.

**À savoir** : hors de la fenêtre de 24 h après le dernier message du client,
Meta refuse toute réponse libre et n'accepte qu'un gabarit pré-approuvé. Le
système le signale explicitement (`outside-24h-window`) au lieu de faire croire
à un envoi.

---

## 3. Telegram — votre écran de validation

1. Sur Telegram, écrivez à **@BotFather** → `/newbot`, suivez les questions.
   Il vous donne un jeton : c'est `TELEGRAM_BOT_TOKEN`.
2. Écrivez un message à votre nouveau bot (sinon il ne peut pas vous parler).
3. Récupérez votre identifiant de conversation :
   ```bash
   curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getUpdates"
   ```
   Le nombre dans `"chat":{"id":…}` est `TELEGRAM_CHAT_ID`.
4. Inventez une chaîne aléatoire pour `TELEGRAM_WEBHOOK_SECRET`.
5. Déclarez le webhook (une seule fois) :
   ```bash
   curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{
       "url": "https://<votre-domaine>/api/agents/telegram",
       "secret_token": "<TELEGRAM_WEBHOOK_SECRET>",
       "allowed_updates": ["callback_query"]
     }'
   ```

| Variable Vercel | Valeur |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | le jeton de BotFather |
| `TELEGRAM_CHAT_ID` | votre identifiant de conversation |
| `TELEGRAM_ALLOWED_CHAT_IDS` | qui a le droit de **valider** (séparés par des virgules ; par défaut, uniquement `TELEGRAM_CHAT_ID`) |
| `TELEGRAM_WEBHOOK_SECRET` | la chaîne inventée ci-dessus |

`TELEGRAM_ALLOWED_CHAT_IDS` n'est pas un doublon de `TELEGRAM_CHAT_ID` :
authentifier le webhook prouve que Telegram l'a envoyé, pas qui a appuyé sur le
bouton. Ajoutez-y un identifiant seulement pour quelqu'un autorisé à engager
l'entreprise.

---

## 4. Vercel Cron — le travail à heure fixe

Inventez une chaîne aléatoire, mettez-la dans `CRON_SECRET`. Sans elle, les
endpoints planifiés répondent `401` — ils restent fermés, pas ouverts.

[`vercel.json`](../../vercel.json) déclare trois tâches (heures **UTC**) :

| Tâche | Cron | Heure locale | Ce qu'elle fait |
| --- | --- | --- | --- |
| `follow-ups` | `0 * * * *` | chaque heure | Relance les prospects silencieux — 2 maximum, jamais entre 21 h et 8 h, jamais un dossier santé |
| `daily-brief` | `0 12 * * *` | 19 h | Le brief de la veille au soir |
| `weekly-report` | `0 1 * * 1` | lundi 8 h | Bilan hebdo + le message prêt pour Discovery Divers |

---

## Vérification de bout en bout

Une fois les variables déployées, quatre gestes :

1. Envoyez un WhatsApp au numéro : *« Bonjour, nous sommes 2, jamais plongé, un baptême le 20/09 ? »*
2. Une carte arrive dans Telegram : priorité, raison, brouillon complet, deux boutons.
3. Appuyez sur **✅ Approuver**.
4. La réponse arrive sur le WhatsApp de test, et la carte se réécrit en
   « Approuvé par … — envoyé ».

Puis les tâches, à la main :

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://<votre-domaine>/api/agents/cron/daily-brief
```

Le brief doit apparaître dans Telegram, et la réponse JSON dire ce qui a été
fait ou volontairement pas fait.

### Si quelque chose ne marche pas

| Symptôme | Cause la plus fréquente |
| --- | --- |
| Meta refuse d'enregistrer le webhook | `WHATSAPP_VERIFY_TOKEN` pas encore déployé, ou différent de celui saisi |
| `401 invalid signature` dans les logs Vercel | `WHATSAPP_APP_SECRET` erroné (c'est l'*App secret*, pas le jeton) |
| Message reçu, aucune carte Telegram | variables Telegram absentes — l'action est en file, silencieuse mais pas perdue (`select * from queue_items where status = 'pending'`) |
| Bouton sans effet, « Ce compte n'est pas autorisé » | votre `chat.id` n'est pas dans `TELEGRAM_ALLOWED_CHAT_IDS` |
| « Approuvé mais NON envoyé » | le garde-fou a relu le brouillon à l'envoi et y a trouvé une promesse interdite — c'est le filet, pas une panne |
| Rien n'est mémorisé entre deux déploiements | Supabase pas branché : le système tourne sur son stockage en mémoire |

---

## Ce qui reste volontairement manuel

Les canaux restent en **rédaction seule** (`draft_only` dans
[`src/agents/config.ts`](../../src/agents/config.ts)). Approuver depuis Telegram
est une pression de pouce : le travail de rédaction disparaît, l'humain reste
dans la boucle.

Quand vous aurez observé les brouillons quelque temps et que vous voudrez que
WhatsApp réponde seul aux demandes simples, c'est **une ligne** :

```ts
whatsapp: { enabled: true, automation: "auto_reply", … }
```

Les garde-fous ne changent pas pour autant : argent, places, santé, publications
et avis continuent d'attendre une validation, quoi qu'il arrive.

Et ne sont **jamais** exécutés par le système, même approuvés — encaissement,
remboursement, confirmation de place, annulation, publication, déclaration
d'incident. Approuver enregistre la décision ; l'acte se fait dans l'outil
concerné. La carte Telegram le dit à chaque fois.
