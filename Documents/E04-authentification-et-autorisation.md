# Atelier E04 — Authentification et autorisation

| | |
|---|---|
| **Jour** | 3 |
| **Durée** | 1 h 15 |
| **Chapitres associés** | 08 (Promises), 11 (Express) |
| **Point de départ** | votre projet à l'issue de E03 (ou [E03-morgan-helmet-cors-et-configuration/](E03-morgan-helmet-cors-et-configuration/)) |
| **Correction** | [E04-authentification-et-autorisation/](E04-authentification-et-autorisation/) |

## Objectifs

- **Hacher** les mots de passe avec `scrypt` (module natif `crypto`).
- Délivrer un **jeton JWT** à la connexion et le vérifier à chaque requête.
- Distinguer **authentification** (401 : qui êtes-vous ?) et **autorisation** (403 : en avez-vous le droit ?).
- Protéger les routes avec des **middlewares** `requireAuth` et `requireRole`.

## Contexte

Jusqu'ici, n'importe qui peut créer, modifier ou supprimer un quiz ! Les spécifications (§2) prévoient :

| Action | Visiteur | Apprenant connecté | Formateur |
|---|---|---|---|
| lister / consulter les quiz publiés, soumettre ses réponses | ✅ | ✅ | ✅ |
| voir les brouillons et les bonnes réponses | ❌ | ❌ | ✅ |
| créer, modifier, supprimer | ❌ 401 | ❌ 403 | ✅ |

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/api/auth/login` | `{ email, password }` → `{ token, user }` |
| GET | `/api/auth/me` | le profil de l'utilisateur connecté |

```text
edutrack-express/
├── data/users.json                    ★ créé par le seed (non versionné)
├── scripts/seed.js                    ✎ crée 3 comptes, mots de passe hachés
├── src/
│   ├── app.js                         ✎ monte /api/auth
│   ├── index.js                       ✎ refuse de démarrer sans JWT_SECRET
│   ├── config/index.js                ✎ jwtSecret, jwtExpiresIn
│   ├── controllers/auth.controller.js ★
│   ├── controllers/quiz.controller.js ✎ transmet req.user au service
│   ├── middlewares/auth.js            ★ requireAuth, optionalAuth, requireRole
│   ├── repositories/user.repository.js ★ même principe que le repository de A06
│   ├── routes/auth.routes.js          ★
│   ├── routes/quiz.routes.js          ✎ routes protégées
│   ├── services/auth.service.js       ★ login, verifyToken, getProfile
│   ├── services/password.service.js   ★ hashPassword, verifyPassword
│   ├── services/quiz.service.js       ✎ vue formateur
│   ├── utils/errors.js                ✎ UnauthorizedError, ForbiddenError
│   └── validators/auth.validator.js   ★
├── .env.example                       ✎ JWT_SECRET, JWT_EXPIRES_IN
└── requests.http                      ✎ réécrit, avec les jetons
```

```bash
npm install jsonwebtoken
```

---

## Étape 1 — Hacher les mots de passe

🔐 On ne stocke **jamais** un mot de passe en clair, ni même chiffré (on pourrait le déchiffrer). On stocke une **empreinte** (*hash*) : impossible de revenir au mot de passe, mais on peut vérifier qu'un mot de passe saisi produit la même empreinte.

Créez `src/services/password.service.js` :

```js
const crypto = require('node:crypto');
const util = require('node:util');

const scrypt = util.promisify(crypto.scrypt); // version Promise, comme en A06
const KEY_LENGTH = 64;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, KEY_LENGTH);
  return `${salt}:${hash.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [salt, hashHex] = stored.split(':');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, salt, KEY_LENGTH);
  return crypto.timingSafeEqual(actual, expected);
}

module.exports = { hashPassword, verifyPassword };
```

| | |
|---|---|
| **sel** (*salt*) | aléatoire, différent pour chaque compte : deux utilisateurs ayant le même mot de passe ont des empreintes différentes |
| **scrypt** | volontairement **lent** et gourmand en mémoire : un attaquant qui vole le fichier ne peut tester que peu de mots de passe par seconde |
| **`timingSafeEqual`** | compare en temps **constant** : la durée de la comparaison ne révèle pas combien d'octets sont identiques |

## Étape 2 — Les comptes de démonstration

Complétez `scripts/seed.js` : après la copie des quiz, il crée `data/users.json` avec trois comptes, en hachant les mots de passe **en parallèle** avec `Promise.all`. Comme pour les quiz, l'option `--if-missing` ne crée le fichier que s'il est absent (voir la [correction](E04-authentification-et-autorisation/scripts/seed.js)).

| E-mail | Mot de passe | Rôle |
|---|---|---|
| `formateur@edutrack.local` | `Formateur123!` | `trainer` |
| `formateur2@edutrack.local` | `Formateur123!` | `trainer` |
| `alice@edutrack.local` | `Apprenant123!` | `student` |

Ajoutez `data/users.json` au `.gitignore`, puis lancez `npm run seed` et ouvrez le fichier : aucun mot de passe n'y apparaît, seulement `"passwordHash": "sel:empreinte"`.

Créez ensuite `src/repositories/user.repository.js`, sur le modèle du repository de A06 (`fs/promises`, chemin calculé avec `__dirname`) : `findByEmail(email)` et `findById(id)`.

## Étape 3 — Le secret JWT

Un **JWT** (*JSON Web Token*) est une chaîne en trois parties, `en-tête.contenu.signature`. Le contenu est **lisible par tous** (simple encodage base64) : on n'y met jamais de secret. La **signature**, calculée avec `JWT_SECRET`, garantit que le contenu n'a pas été modifié. Sans le secret, impossible de fabriquer un jeton valide.

Ajoutez à `.env.example` et à votre `.env` :

```ini
# node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
JWT_SECRET=remplacez-moi-par-une-longue-valeur-aleatoire
JWT_EXPIRES_IN=2h
```

Dans `src/config/index.js` :

```js
jwtSecret: process.env.JWT_SECRET, // AUCUNE valeur par défaut !
jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '2h',
```

Et dans `src/index.js`, avant `app.listen` :

```js
if (!config.jwtSecret) {
  console.error('❌ JWT_SECRET manquant : copiez .env.example en .env et renseignez-le.');
  process.exit(1);
}
```

> ⚠️ Un secret « par défaut » écrit dans le code serait connu de **tous** ceux qui lisent le dépôt. Mieux vaut refuser de démarrer.

## Étape 4 — Le service d'authentification

Ajoutez à `src/utils/errors.js` :

```js
class UnauthorizedError extends AppError { // 401 : qui êtes-vous ?
  constructor(message = 'Authentification requise') { super(message, 401); }
}
class ForbiddenError extends AppError { // 403 : vous n'avez pas le droit
  constructor(message = 'Accès interdit') { super(message, 403); }
}
```

Créez `src/services/auth.service.js` :

```js
const jwt = require('jsonwebtoken');

async function login(email, password) {
  const user = await userRepository.findByEmail(email);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new UnauthorizedError('E-mail ou mot de passe incorrect');
  }
  const token = jwt.sign(
    { sub: user.id, role: user.role, name: user.name },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn, algorithm: 'HS256' },
  );
  return { token, user: toPublicUser(user) };
}

function verifyToken(token) {
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    return { id: payload.sub, role: payload.role, name: payload.name };
  } catch {
    throw new UnauthorizedError('Jeton invalide ou expiré');
  }
}
```

Ajoutez `toPublicUser(user)`, qui renvoie `{ id, email, name, role }` (**jamais** `passwordHash`), et `getProfile(userId)`.

> 🔐 **Même message** que l'e-mail soit inconnu ou que le mot de passe soit faux : on ne révèle pas quels comptes existent.
>
> 🔐 `algorithms: ['HS256']` : on n'accepte **que** l'algorithme attendu. Sans cette option, certaines bibliothèques acceptaient autrefois un jeton « non signé » (`alg: none`).

## Étape 5 — Les middlewares

Créez `src/middlewares/auth.js`. Le client envoie son jeton dans l'en-tête `Authorization: Bearer <jeton>` :

```js
function readToken(req) {
  const header = req.get('Authorization') ?? '';
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

// AUTHENTIFICATION obligatoire : 401 sans jeton valide
function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) throw new UnauthorizedError();
  req.user = verifyToken(token);
  next();
}

// Authentification FACULTATIVE : un visiteur passe, mais un jeton présent doit être valide
function optionalAuth(req, res, next) {
  const token = readToken(req);
  if (token) req.user = verifyToken(token);
  next();
}

// AUTORISATION : 403 si le rôle ne convient pas (à placer APRÈS requireAuth)
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError(`Action réservée au rôle : ${roles.join(', ')}`);
    }
    next();
  };
}
```

> 🔎 Les middlewares **enrichissent** `req` : après `requireAuth`, tous les middlewares suivants et le contrôleur disposent de `req.user`.

## Étape 6 — Les routes

Créez le validateur `validateLogin` (e-mail contenant `@`, mot de passe non vide), le contrôleur et le routeur de l'authentification :

```js
router.post('/login', requireJson, validate(validateLogin), controller.login);
router.get('/me', requireAuth, controller.me);
```

Montez-le dans `app.js` : `app.use('/api/auth', authRoutes);`

Protégez ensuite les routes des quiz :

```js
const trainerOnly = [requireAuth, requireRole('trainer')];

router.route('/')
  .get(optionalAuth, controller.list)
  .post(trainerOnly, requireJson, validate(validateQuiz), controller.create)
  ...
router.route('/:id')
  .get(optionalAuth, controller.getOne)
  .patch(trainerOnly, requireJson, validate(validateQuizUpdate), controller.update)
  .delete(trainerOnly, controller.remove)
  ...
// /:id/submit reste PUBLIC : passer un quiz ne demande pas de compte
```

> 💡 Express accepte un **tableau** de middlewares (`trainerOnly`) comme un middleware unique.
>
> 🔐 Les droits sont vérifiés **en premier** : inutile de valider un corps envoyé par quelqu'un qui n'a pas le droit d'agir.

## Étape 7 — La vue formateur

Un formateur doit voir **tous** les quiz, brouillons compris, **avec** les bonnes réponses. Le contrôleur transmet `req.user` au service (`undefined` pour un visiteur) :

```js
async function list(req, res) {
  res.json(await quizService.listQuizzes(req.user));
}
```

Dans le service :

```js
const isTrainer = (user) => user?.role === 'trainer';

async function listQuizzes(user) {
  const quizzes = await quizRepository.findAll();
  if (isTrainer(user)) {
    return quizzes.map((q) => ({ ...toSummary(q), published: q.published }));
  }
  return quizzes.filter((q) => q.published).map(toSummary);
}

async function getQuiz(id, user) {
  if (isTrainer(user)) return findOrFail(id); // version complète
  return toPublicQuiz(await findPublished(id));
}
```

> 🔎 La **règle** (« qui voit quoi ») reste dans le service. Le contrôleur se contente de transmettre l'utilisateur.

## Vérifications

> 🔁 **Scénario fetch** : [scripts/scenario.js](E04-authentification-et-autorisation/scripts/scenario.js) rejoue les principales étapes de l'atelier avec des appels `fetch` enchaînés par `.then()`. Serveur démarré dans un autre terminal, lancez `npm run scenario`.

```bash
npm run seed     # recrée les quiz ET les comptes
npm run dev
```

Le fichier [requests.http](E04-authentification-et-autorisation/requests.http) est réécrit : lancez d'abord les **deux connexions**, les jetons sont ensuite réutilisés automatiquement.

| Requête | Attendu |
|---|---|
| démarrage sans `JWT_SECRET` | message d'erreur, arrêt |
| login avec un mauvais mot de passe, ou un e-mail inconnu | 401, **même** message |
| login sans mot de passe | 400 |
| `GET /api/auth/me` sans jeton / avec un jeton modifié | 401 / 401 `Jeton invalide ou expiré` |
| `GET /api/auth/me` avec le jeton du formateur | 200, sans `passwordHash` |
| `GET /api/quizzes` : visiteur / formateur | 16 quiz / 17 quiz, avec `published` |
| `GET /api/quizzes/2` (brouillon) : visiteur ou apprenante / formateur | 404 / 200, avec `isCorrect` |
| `POST /api/quizzes` : sans jeton / apprenante / formateur | 401 / 403 / 201 |
| PATCH, DELETE avec le jeton de l'apprenante | 403 |
| `POST /api/quizzes/1/submit` sans jeton | 200 : passer un quiz reste public |

> 💡 Collez un jeton sur <https://jwt.io> : le contenu (`sub`, `role`, `name`, `exp`) est lisible par n'importe qui. Modifiez-y le rôle, puis renvoyez le jeton : 401, la signature ne correspond plus.

## Récapitulatif

- 🔐 Mots de passe : **sel + scrypt**, comparaison en temps constant ; jamais de mot de passe ni d'empreinte dans une réponse.
- Un **JWT signé** prouve l'identité sans session côté serveur ; son contenu est lisible, pas modifiable.
- **401** : pas authentifié ; **403** : authentifié, mais pas autorisé.
- `requireAuth`, `optionalAuth` et `requireRole` sont de simples middlewares qui enrichissent `req.user` ou lèvent une erreur.
- Les règles d'accès aux données restent dans le **service**.

## Pour aller plus loin

- Ajoutez `POST /api/auth/register` pour créer un compte **apprenant** (jamais formateur !). Pensez au doublon d'e-mail (409).
- Limitez les tentatives de connexion avec le paquet `express-rate-limit`.
- Une application front-end (React, Vue…) devra conserver le jeton entre deux requêtes : où le ranger dans le navigateur, et avec quels risques ?

## Et ensuite ?

Votre API a maintenant le découpage de la correction [A15](../Jour3/A15-authentification-et-autorisation/), et toutes ses fonctionnalités sauf l'import de fichier (vu en A14, avec Multer). Au jour 4, nous remplacerons les fichiers JSON par une base de données SQLite ([E05](E05-connecter-sqlite.md) à [E07](E07-persister-les-quiz.md)), puis nous écrirons les tests automatisés ([E08](E08-tests-mocha-chai.md)). L'essentiel du travail portera sur les **repositories** : les routes, les middlewares et les validateurs ne changeront presque pas. Ce sera une nouvelle fois la preuve que le découpage en couches est utile.
