# Atelier E02 — Middlewares, validation et gestion des erreurs

| | |
|---|---|
| **Jour** | 3 |
| **Durée** | 1 h 30 |
| **Chapitre associé** | 11 — Express : bases et routage |
| **Point de départ** | votre projet à l'issue de E01 (ou [E01-creer-le-serveur-express/](E01-creer-le-serveur-express/)) |
| **Correction** | [E02-middlewares-et-validation/](E02-middlewares-et-validation/) |

## Objectifs

- Écrire ses propres **middlewares** et comprendre le rôle de **`next()`**.
- **Valider** toutes les données reçues selon les règles des spécifications (§5).
- Centraliser la gestion des erreurs dans un **gestionnaire d'erreurs** dédié.
- Utiliser **`router.param`** et **`router.route`**.
- **Compléter** le repository de A06 pour créer et supprimer des quiz.

## Contexte

À la fin de E01, nous avons relevé quatre défauts : identifiant `abc` accepté, pas de 405, pas de 415, messages d'erreur techniques. Nous les corrigeons, puis nous ajoutons la gestion des quiz :

| Méthode | Route | Rôle | Réponse |
|---|---|---|---|
| POST | `/api/quizzes` | créer un quiz | 201 + `Location`, le quiz |
| PATCH | `/api/quizzes/:id` | modifier le titre ou la description ; publier ou dépublier | 200, le quiz |
| DELETE | `/api/quizzes/:id` | supprimer un quiz | 204 |

```text
edutrack-express/
├── data/
│   ├── seed-quizzes.json               ★ copie de référence (versionnée)
│   └── quizzes.json                    ✎ fichier de travail (non versionné, créé par le seed)
├── scripts/seed.js                     ★ réinitialise les données
├── src/
│   ├── app.js                          ✎ logger, notFound, errorHandler
│   ├── controllers/quiz.controller.js  ✎ create, update, remove ; req.quizId
│   ├── middlewares/
│   │   ├── error-handler.js            ★ 404 et gestionnaire d'erreurs (sortis de app.js)
│   │   ├── logger.js                   ★ journal des requêtes
│   │   └── validate.js                 ★ requireJson, validate, methodNotAllowed
│   ├── repositories/quiz.repository.js ✎ + create(), remove() — le code de A06 ne change pas
│   ├── routes/quiz.routes.js           ✎ router.param, router.route, validation
│   ├── services/quiz.service.js        ✎ createQuiz, updateQuiz, deleteQuiz
│   └── validators/quiz.validator.js    ★ règles de validation (§5)
├── .gitignore                          ✎ data/quizzes.json
├── package.json                        ✎ scripts seed, predev, prestart
└── requests.http                       ✎
```

---

## Étape 1 — Des données que l'on peut réinitialiser

L'API va maintenant **modifier** `data/quizzes.json`. Pour pouvoir revenir à l'état de départ après vos essais :

1. copiez `data/quizzes.json` en `data/seed-quizzes.json` : c'est la **référence**, que l'API ne modifie jamais ;
2. créez `scripts/seed.js`, qui recopie la référence sur le fichier de travail avec `fs.copyFile` (voir la [correction](E02-middlewares-et-validation/scripts/seed.js)) ;
3. ajoutez le script `"seed": "node scripts/seed.js"` à `package.json` ;
4. ajoutez `data/quizzes.json` au `.gitignore` : seule la référence est versionnée.

Le fichier de travail n'étant plus versionné, il est absent juste après un `git clone` : le serveur répondrait alors **500** à chaque requête (`ENOENT` : fichier introuvable). Pour l'éviter, `seed.js` accepte l'option `--if-missing` : il ne crée alors que les fichiers **absents**. npm lance tout seul un script nommé `pre<nom>` **avant** le script `<nom>` :

```json
"scripts": {
  "prestart": "node scripts/seed.js --if-missing",
  "start": "node src/index.js",
  "predev": "node scripts/seed.js --if-missing",
  "dev": "node --watch src/index.js",
  "seed": "node scripts/seed.js"
}
```

`npm run dev` crée donc les données si besoin, puis démarre le serveur. `npm run seed`, lui, remet **toujours** les données dans leur état de départ.

## Étape 2 — Un premier middleware : le journal des requêtes

Un middleware est une fonction **`(req, res, next)`**. Elle peut :

- **répondre** (`res.json(...)`) : la chaîne s'arrête ;
- **passer la main** avec `next()` : Express appelle le middleware suivant ;
- **signaler une erreur** (`throw` ou `next(erreur)`) : Express saute directement au gestionnaire d'erreurs.

Créez `src/middlewares/logger.js` :

```js
function logger(req, res, next) {
  const start = performance.now();
  res.on('finish', () => {
    const ms = Math.round(performance.now() - start);
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms} ms`);
  });
  next();
}

module.exports = { logger };
```

> 🔎 Le statut n'est connu **qu'à la fin** : on s'abonne donc à l'événement `finish` de la réponse. `res` est un `EventEmitter`, comme la `QuizSession` du jour 1.
>
> ⚠️ **Oublier `next()`** est l'erreur la plus classique : la requête reste bloquée et le client attend indéfiniment.

## Étape 3 — Les validateurs

Créez `src/validators/quiz.validator.js`. Chaque validateur est une **fonction pure** : il reçoit les données et renvoie un **tableau de messages** (vide si tout est correct). Il ne connaît ni Express ni HTTP.

| Validateur | Règles |
|---|---|
| `validateQuiz(data)` | `title` de 3 à 120 caractères ; `description` de 500 caractères au plus (facultative) ; `published` booléen (facultatif) ; au moins une question ; chaque question a un `statement` non vide et **2 à 6** réponses, chacune avec un `label` non vide et un `isCorrect` booléen, dont **exactement une** correcte |
| `validateQuizUpdate(data)` | au moins un champ ; seuls `title`, `description` et `published` sont acceptés, avec les mêmes règles |
| `validateSubmission(data)` | `answers` est un tableau ; chaque élément a un `questionId` entier et un `answerId` entier ou `null` |

Extrait :

```js
data.questions.forEach((question, i) => {
  const where = `questions[${i}]`;
  if (!isNonEmptyString(question?.statement, 500)) {
    errors.push(`${where}.statement : énoncé obligatoire (500 caractères au plus)`);
  }
  // ... réponses
  if (answers.filter((a) => a?.isCorrect === true).length !== 1) {
    errors.push(`${where}.answers : exactement une réponse correcte`);
  }
});
```

> 💡 **On collecte toutes les erreurs** au lieu de s'arrêter à la première : le client corrige tout en une seule fois. Le préfixe `questions[0].answers[1].label` lui indique précisément où est le problème.
>
> 💡 L'opérateur **`?.`** évite de planter si `question` vaut `null` : `null?.statement` vaut `undefined`.

La correction complète est dans [src/validators/quiz.validator.js](E02-middlewares-et-validation/src/validators/quiz.validator.js).

## Étape 4 — Les middlewares de contrôle

Créez `src/middlewares/validate.js` :

```js
const { AppError, ValidationError } = require('../utils/errors');

function requireJson(req, res, next) {
  if (!req.is('application/json')) {
    throw new AppError('Le corps doit être au format JSON (Content-Type: application/json)', 415);
  }
  next();
}

function validate(validator) {
  return (req, res, next) => {
    const errors = validator(req.body);
    if (errors.length > 0) throw new ValidationError('Données invalides', errors);
    next();
  };
}

function methodNotAllowed(allowed) {
  return (req, res) => {
    res.set('Allow', allowed.join(', '));
    res.status(405).json({ error: `Méthode ${req.method} non autorisée` });
  };
}

module.exports = { requireJson, validate, methodNotAllowed };
```

> 🔎 `validate` et `methodNotAllowed` sont des **fabriques** : elles **retournent** un middleware configuré. `validate(validateQuiz)` et `validate(validateSubmission)` sont deux middlewares différents, construits à partir du même code.

## Étape 5 — Les routes

Réécrivez `src/routes/quiz.routes.js` :

```js
router.param('id', (req, res, next, value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new ValidationError(`Identifiant invalide : ${value}`);
  req.quizId = id;
  next();
});

router
  .route('/')
  .get(controller.list)
  .post(requireJson, validate(validateQuiz), controller.create)
  .all(methodNotAllowed(['GET', 'POST']));

router
  .route('/:id')
  .get(controller.getOne)
  .patch(requireJson, validate(validateQuizUpdate), controller.update)
  .delete(controller.remove)
  .all(methodNotAllowed(['GET', 'PATCH', 'DELETE']));

router
  .route('/:id/submit')
  .post(requireJson, validate(validateSubmission), controller.submit)
  .all(methodNotAllowed(['POST']));
```

- **`router.param('id', ...)`** s'exécute pour **toute** route contenant `:id`, avant ses middlewares. L'identifiant est vérifié une fois, puis rangé dans `req.quizId`, sous forme de nombre.
- **`router.route(chemin)`** regroupe les méthodes d'un même chemin ; **`.all(...)`** attrape toutes les autres méthodes, d'où le 405.
- Une route peut enchaîner **plusieurs** fonctions : `requireJson → validate(...) → contrôleur`.

## Étape 6 — Compléter le repository de A06

Le repository de A06 sait lire (`findAll`, `findById`) et enregistrer un quiz **existant** (`save`). Il lui manque deux opérations. **Ajoutez-les à la fin du fichier, sans modifier les fonctions de A06** :

```js
// Plus grand identifiant d'une liste (0 si elle est vide).
const maxId = (items) => items.reduce((max, item) => Math.max(max, item.id), 0);

// Crée un quiz en lui attribuant ses identifiants (quiz, questions, réponses).
async function create(data) {
  const quizzes = await readAll();
  const allQuestions = quizzes.flatMap((q) => q.questions);
  let questionId = maxId(allQuestions);
  let answerId = maxId(allQuestions.flatMap((q) => q.answers));

  const quiz = {
    id: maxId(quizzes) + 1,
    ...data,
    questions: data.questions.map((q) => ({
      id: ++questionId,
      statement: q.statement,
      answers: q.answers.map((a) => ({ id: ++answerId, label: a.label, isCorrect: a.isCorrect })),
    })),
  };

  quizzes.push(quiz);
  await writeAll(quizzes); // l'écriture atomique de A06
  return quiz;
}
```

Écrivez vous-même `remove(id)` : il réécrit le fichier sans le quiz et renvoie `true`, ou `false` si le quiz n'existait pas. N'oubliez pas d'exporter les deux fonctions.

> 💡 `readAll` et `writeAll` (avec son écriture atomique : fichier temporaire, puis `rename`) sont **réutilisées** par les nouvelles fonctions. Attribuer les identifiants est le rôle du **stockage** : au jour 4, la base de données s'en chargera.

## Étape 7 — Le service et le contrôleur

Le **format** des données est maintenant garanti par les validateurs. Dans le service :

- supprimez le contrôle provisoire de `answers` dans `submitAnswers` ;
- ajoutez `findOrFail(id)`, qui retrouve un quiz publié ou non (sinon `NotFoundError`). `findPublished` peut s'appuyer dessus ;
- ajoutez `createQuiz(data)` : il recopie **champ par champ** `title` (sans espaces autour), `description` (`''` par défaut), `published` (`false` par défaut), `createdAt` (la date du jour), et les questions et réponses, puis appelle `quizRepository.create(...)` ;
- ajoutez `updateQuiz(id, changes)` : `findOrFail`, modification des champs présents, puis `quizRepository.save(quiz)`. C'est le `save` de A06 ;
- ajoutez `deleteQuiz(id)` : `quizRepository.remove(id)`, puis `NotFoundError` s'il renvoie `false`.

> ⚠️ **Pourquoi recopier champ par champ ?** Avec `quizRepository.create(data)`, un client pourrait envoyer `"id": 1` ou `"createdAt": "1970-01-01"` et écraser des valeurs que seul le serveur doit fixer.

Dans le contrôleur, utilisez `req.quizId` à la place de `Number(req.params.id)`, et ajoutez :

```js
async function create(req, res) {
  const quiz = await quizService.createQuiz(req.body);
  res.status(201).location(`/api/quizzes/${quiz.id}`).json(quiz);
}

async function update(req, res) {
  res.json(await quizService.updateQuiz(req.quizId, req.body));
}

async function remove(req, res) {
  await quizService.deleteQuiz(req.quizId);
  res.status(204).end(); // 204 No Content : succès, sans corps
}
```

> 🔎 **Qui vérifie quoi ?** Le **validateur** vérifie la *forme* (types, longueurs), sans rien connaître des données stockées. Le **service** vérifie ce qui dépend des données (« ce quiz existe-t-il ? », « cette question lui appartient-elle ? »).

## Étape 8 — Le gestionnaire d'erreurs

Déplacez le 404 et le gestionnaire d'erreurs de `app.js` vers `src/middlewares/error-handler.js`, et améliorez les messages de `express.json` :

```js
function errorHandler(error, req, res, next) {
  if (error instanceof AppError) {
    return res.status(error.status).json({ error: error.message, details: error.details });
  }
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON invalide' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Corps de requête trop volumineux' });
  }
  console.error(error);
  res.status(500).json({ error: 'Erreur interne du serveur' });
}
```

`src/app.js` devient :

```js
app.use(logger);
app.use(express.json({ limit: '100kb' }));
app.get('/', ...); // inchangé
app.use('/api/quizzes', quizRoutes);
app.use(notFound);
app.use(errorHandler);
```

## Vérifications

> 🔁 **Scénario fetch** : [scripts/scenario.js](E02-middlewares-et-validation/scripts/scenario.js) rejoue les principales étapes de l'atelier avec des appels `fetch` enchaînés par `.then()`. Serveur démarré dans un autre terminal, lancez `npm run scenario`.

```bash
npm run dev      # crée data/quizzes.json s'il manque
```

Utilisez [requests.http](E02-middlewares-et-validation/requests.http). Avec REST Client, `# @name draft` permet de réutiliser l'identifiant du quiz créé (`{{draft.response.body.id}}`).

| Requête | Statut attendu |
|---|---|
| `GET /api/quizzes/abc` ou `/0` | 400 `Identifiant invalide` |
| `DELETE /api/quizzes` | 405, `Allow: GET, POST` |
| `PUT /api/quizzes/1` | 405, `Allow: GET, PATCH, DELETE` |
| POST submit avec `Content-Type: text/plain` | 415 |
| POST submit avec un JSON tronqué | 400 `JSON invalide` |
| POST submit avec `"questionId": "1"` (une chaîne) | 400, `details` |
| POST quiz avec titre `ab` et deux bonnes réponses | 400, `details` liste chaque problème |
| POST quiz valide sans `published` | 201 + `Location: /api/quizzes/18`, brouillon ; `GET` sur ce quiz → 404 |
| PATCH `{ "published": true }` | 200 ; `GET` → 200 |
| PATCH `{ "id": 1 }` ou `{}` | 400 |
| DELETE, puis à nouveau DELETE | 204, puis 404 |

Le terminal du serveur affiche une ligne par requête : `PATCH /api/quizzes/18 200 7 ms`.

Ouvrez `data/quizzes.json` après la création : le nouveau quiz y est, avec ses identifiants. `npm run seed` remet tout en ordre.

## Récapitulatif

- Un middleware appelle **`next()`** pour passer la main, ou lève une erreur pour sauter au gestionnaire d'erreurs.
- Les **validateurs** sont des fonctions pures ; le middleware `validate` les relie à Express.
- `router.param` factorise le contrôle d'un paramètre ; `router.route(...).all(...)` gère le 405.
- **Un seul** gestionnaire d'erreurs, en fin de chaîne, transforme toute erreur en réponse JSON cohérente.
- Le repository de A06 a été **étendu**, pas réécrit : ses fonctions existantes servent toujours (`save` pour PATCH, `writeAll` pour `create` et `remove`).

## Pour aller plus loin

- Ajoutez une règle : deux réponses d'une même question ne peuvent pas avoir le même libellé.
- Faites en sorte que `GET /api/quizzes?published=false` liste aussi les brouillons. Pourquoi est-ce une mauvaise idée tant qu'il n'y a pas d'authentification ? (Réponse en E04.)
- Remplacez le validateur maison par une bibliothèque comme **zod** ou **joi** : comparez la longueur du code.
