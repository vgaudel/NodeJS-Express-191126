# Atelier E03 — Morgan, Helmet, CORS et configuration

| | |
|---|---|
| **Jour** | 3 |
| **Durée** | 30 minutes |
| **Chapitre associé** | 12 — Express : middlewares tiers |
| **Point de départ** | votre projet à l'issue de E02 (ou [E02-middlewares-et-validation/](E02-middlewares-et-validation/)) |
| **Correction** | [E03-morgan-helmet-cors-et-configuration/](E03-morgan-helmet-cors-et-configuration/) |

## Objectifs

- Utiliser des **middlewares tiers** : **Morgan** (journal), **Helmet** (en-têtes de sécurité), **cors** (accès depuis d'autres origines).
- Configurer l'application avec un fichier **`.env`**, chargé nativement par Node.js.

## Contexte

```text
edutrack-express/
├── src/
│   ├── app.js                       ✎ helmet, cors, morgan
│   ├── config/index.js              ★ env, port, corsOrigins
│   ├── index.js                     ✎ utilise la configuration
│   └── middlewares/logger.js        ✖ remplacé par Morgan
├── .env.example                     ★ NODE_ENV, PORT, CORS_ORIGIN
└── package.json                     ✎ --env-file-if-exists ; 3 dépendances
```

---

## Étape 1 — Installer les paquets

```bash
npm install morgan helmet cors
```

Supprimez `src/middlewares/logger.js` : Morgan le remplace, avec plus d'options.

## Étape 2 — La configuration par fichier `.env`

Une application ne doit pas contenir de valeurs « en dur » qui changent d'un poste à l'autre (port, origines autorisées, secrets…). On les lit dans les **variables d'environnement**.

Créez `src/config/index.js`, **le seul fichier** qui lit `process.env` :

```js
module.exports = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT) || 3000,
  // « http://a.fr,http://b.fr » → ['http://a.fr', 'http://b.fr'] ; vide → []
  corsOrigins: (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};
```

Créez `.env.example`, **versionné**, qui documente les variables attendues :

```ini
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:5173
```

Copiez-le en `.env` (**non versionné** : il est déjà dans `.gitignore`), puis demandez à Node.js de le charger dans `package.json` :

```json
"start": "node --env-file-if-exists=.env src/index.js",
"dev": "node --watch --env-file-if-exists=.env src/index.js"
```

Enfin, dans `src/index.js`, remplacez `process.env.PORT` par `config.port`.

> 💡 Depuis Node.js 20.6, l'option `--env-file` remplace le paquet `dotenv`. La variante `--env-file-if-exists` (Node.js 22) ne plante pas si le fichier est absent, ce qui est le cas en production : les variables y sont définies sur le serveur.

## Étape 3 — Helmet, CORS et Morgan

Dans `src/app.js`, **au début** de la chaîne :

```js
app.use(helmet());
app.use(cors({ origin: config.corsOrigins }));
if (config.env !== 'test') {
  app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
}
```

| Middleware | Rôle |
|---|---|
| `helmet()` | ajoute douze **en-têtes de sécurité** (détail ci-dessous) : `Content-Security-Policy` (d'où le navigateur peut-il charger des scripts ?), `X-Content-Type-Options: nosniff`… et retire `X-Powered-By: Express`, qui renseignait un attaquant |
| `cors(...)` | autorise une application front-end hébergée sur **une autre origine** (par exemple une application React sur `http://localhost:5173`) à appeler l'API depuis le navigateur. Seules les origines listées reçoivent l'en-tête `Access-Control-Allow-Origin` |
| `morgan('dev')` | une ligne colorée par requête : méthode, URL, statut, durée, taille |

> 💡 Notre API ne renvoie que du JSON, mais Helmet reste utile : `X-Content-Type-Options: nosniff` empêche par exemple un navigateur d'interpréter une réponse JSON comme du HTML ou du JavaScript.
>
> 🔎 **CORS protège les utilisateurs, pas le serveur.** C'est le **navigateur** qui refuse de donner la réponse à une page d'une origine non autorisée. `curl` ou REST Client, eux, ignorent CORS.

### Ce que fait Helmet, en détail

Helmet ne modifie pas le corps des réponses. Il ajoute des **en-têtes HTTP**, qui sont des **consignes données au navigateur** : « n'exécute que les scripts de ce site », « n'affiche pas cette page dans un cadre », « ne devine pas le type du contenu »… Un navigateur moderne les respecte. Un attaquant qui interroge l'API avec `curl` n'est pas concerné : Helmet protège surtout les **utilisateurs** contre les pages malveillantes qui tenteraient d'utiliser notre site.

Voici ce qu'ajoute `helmet()` avec ses réglages par défaut (version 8) :

| En-tête | Valeur par défaut | Protège contre |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'self'…` | l'**injection de scripts** (XSS) : le navigateur ne charge des scripts, images, styles… que depuis notre propre origine (`'self'`), et refuse les plugins (`object-src 'none'`) |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | l'interception en HTTP : pendant un an, le navigateur n'utilisera **que HTTPS** pour ce site (ignoré tant que le site est servi en HTTP, comme sur `localhost`) |
| `X-Content-Type-Options` | `nosniff` | le « reniflage » de type : le navigateur respecte le `Content-Type` annoncé et n'exécute pas comme script un contenu déclaré JSON |
| `X-Frame-Options` | `SAMEORIGIN` | le **clickjacking** : une autre origine ne peut pas afficher nos pages dans un `<iframe>` invisible pour piéger les clics (doublé par `frame-ancestors` de la CSP) |
| `Referrer-Policy` | `no-referrer` | les fuites d'URL : quand on suit un lien, le site de destination ne reçoit pas l'adresse de la page d'origine (qui peut contenir un identifiant) |
| `Cross-Origin-Opener-Policy` | `same-origin` | une page ouverte depuis une autre origine (`window.open`) ne peut pas manipuler la nôtre |
| `Cross-Origin-Resource-Policy` | `same-origin` | une autre origine ne peut pas **intégrer** nos réponses dans ses pages (`<img>`, `<script>`…). Les appels `fetch` autorisés par CORS ne sont pas concernés |
| `Origin-Agent-Cluster` | `?1` | isole notre origine dans son propre processus du navigateur |
| `X-DNS-Prefetch-Control` | `off` | la résolution DNS anticipée des liens d'une page, qui révèle aux serveurs DNS les sites que l'on pourrait visiter |
| `X-Download-Options` | `noopen` | l'ouverture directe d'un fichier téléchargé dans le contexte du site (ancien Internet Explorer) |
| `X-Permitted-Cross-Domain-Policies` | `none` | l'accès aux données par d'anciens plugins (Flash, Acrobat) |
| `X-XSS-Protection` | `0` | **désactive** l'ancien filtre anti-XSS des navigateurs : il était lui-même exploitable. La CSP le remplace |

Et un en-tête **disparaît** :

| En-tête retiré | Pourquoi |
|---|---|
| `X-Powered-By: Express` | il annonçait la technologie du serveur. Un attaquant qui sait qu'il s'agit d'Express sait aussi quelles failles connues tester en priorité |

> 💡 Chaque protection se règle séparément. Par exemple, `helmet({ contentSecurityPolicy: false })` désactive la CSP, et `helmet({ referrerPolicy: { policy: 'same-origin' } })` en change la valeur. Les réglages par défaut conviennent très bien à une API JSON comme la nôtre : on n'y touche que lorsqu'une page web légitime est bloquée.
>
> ⚠️ Helmet n'est **qu'une couche** de protection. Il ne remplace ni la validation des données (E02), ni l'authentification (E04), ni HTTPS en production.

## Vérifications

> 🔁 **Scénario fetch** : [scripts/scenario.js](E03-morgan-helmet-cors-et-configuration/scripts/scenario.js) rejoue les principales étapes de l'atelier avec des appels `fetch` enchaînés par `.then()`. Serveur démarré dans un autre terminal, lancez `npm run scenario`.

Utilisez la section « E03 » de [requests.http](E03-morgan-helmet-cors-et-configuration/requests.http).

| Vérification | Attendu |
|---|---|
| en-têtes de `GET /api/quizzes/1` | les douze en-têtes du tableau de Helmet, dont `Content-Security-Policy` et `X-Content-Type-Options: nosniff` ; **plus** de `X-Powered-By` |
| `GET /api/quizzes` avec `Origin: http://localhost:5173` | `Access-Control-Allow-Origin: http://localhost:5173` |
| `GET /api/quizzes` avec `Origin: https://site-pirate.example` | pas d'en-tête `Access-Control-Allow-Origin` |
| `PORT=4000` dans `.env`, puis redémarrage | le serveur écoute sur le port 4000 |
| terminal du serveur | `GET /api/quizzes 200 4.364 ms - 2646` (format de Morgan) |

## Et TypeScript ?

Le chapitre 12 présente TypeScript, qui ajoute des **types** à JavaScript. Ils sont vérifiés **avant** l'exécution :

```ts
function computeScore(quiz: Quiz, responses: Response[]): ScoreResult { ... }
```

Nous restons en JavaScript dans ce projet. Pour essayer, Node.js 23.6 et les versions suivantes exécutent directement un fichier `.ts` simple (`node fichier.ts`), en ignorant les types. La vérification des types, elle, reste le travail du compilateur `tsc`.

## Récapitulatif

- Un middleware tiers s'installe avec npm et s'ajoute avec `app.use(...)`, comme les nôtres.
- **Helmet** durcit les en-têtes ; **cors** liste les origines autorisées ; **Morgan** journalise.
- La configuration vient des **variables d'environnement**, lues à un seul endroit (`src/config`) ; `.env` reste local, `.env.example` est versionné.

## Pour aller plus loin

- Désactivez Helmet, puis comparez les en-têtes de réponse (`curl -i`).
- Ouvrez <http://localhost:3000/> dans le navigateur, puis l'onglet **Réseau** des outils de développement (F12) : retrouvez chaque en-tête du tableau de Helmet dans la réponse.
- Ajoutez une variable `JSON_LIMIT` (taille maximale d'un corps JSON, `100kb` par défaut) et utilisez-la dans `express.json({ limit: config.jsonLimit })`.
- Lancez le serveur avec `NODE_ENV=production` : comparez le format du journal de Morgan.
