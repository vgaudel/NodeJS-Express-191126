# Atelier E01 — Créer le serveur Express et y intégrer le code de A06

| | |
|---|---|
| **Jour** | 3 |
| **Durée** | 1 heure |
| **Chapitre associé** | 11 — Express : bases et routage |
| **Point de départ** | un dossier **vide**, plus votre projet A06 (ou [../Jour2/A06-promises-et-async-await/](../Jour2/A06-promises-et-async-await/)) |
| **Correction** | [E01-creer-le-serveur-express/](E01-creer-le-serveur-express/) |

## Objectifs

- Créer un projet Node.js **de zéro** et y installer **Express 5**.
- **Réutiliser** du code existant (le repository et le calcul du score de A06) en le rangeant dans la bonne couche.
- Organiser l'API en **routes**, **contrôleurs** et **services**.
- Lire un corps JSON avec `express.json()`.
- Comprendre le **gestionnaire d'erreurs** d'Express et la gestion automatique des erreurs `async` d'Express 5.

## Contexte

Au jour 2, A06 a produit du code utile : un **repository** qui lit et écrit les quiz avec `fs/promises`, et une fonction **`computeScore`** qui corrige un quiz. Ce code était utilisé par une CLI. Nous allons l'exposer sous forme d'**API REST** : le serveur ne renvoie que du **JSON**, aucune page web. Un autre programme (application mobile, site écrit avec un framework front-end, script…) pourra s'en servir. Nous la testerons avec REST Client ou `curl`.

| Méthode | Route | Rôle | Réponse |
|---|---|---|---|
| GET | `/` | description de l'API | 200, JSON |
| GET | `/api/quizzes` | liste des quiz **publiés** | 200, résumés |
| GET | `/api/quizzes/:id` | un quiz publié, **sans les bonnes réponses** | 200, ou 404 |
| POST | `/api/quizzes/:id/submit` | corriger les réponses d'un apprenant | 200, le score |

```text
edutrack-express/
├── data/quizzes.json                 ← copié de A06
├── src/
│   ├── repositories/
│   │   └── quiz.repository.js        ← copié de A06, SANS modification
│   ├── services/
│   │   ├── score.service.js          ← copié de A06, SANS modification
│   │   └── quiz.service.js           ★ règles métier
│   ├── controllers/
│   │   └── quiz.controller.js        ★ requête HTTP ↔ service
│   ├── routes/
│   │   └── quiz.routes.js            ★ URL → contrôleur
│   ├── utils/errors.js               ★ erreurs métier (avec un statut HTTP)
│   ├── app.js                        ★ l'application Express
│   └── index.js                      ★ la mise à l'écoute
├── requests.http                     ★
└── package.json
```

Le trajet d'une requête :

```text
requête → app.js (middlewares) → quiz.routes.js → quiz.controller.js → quiz.service.js → quiz.repository.js
                                                                              └→ score.service.js
```

---

## Étape 1 — Créer le projet

```bash
mkdir edutrack-express
cd edutrack-express
npm init -y
npm install express@5
```

Complétez `package.json` (voir la [correction](E01-creer-le-serveur-express/package.json)) :

```json
{
  "name": "edutrack-express",
  "main": "src/index.js",
  "type": "commonjs",
  "engines": { "node": ">=22" },
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js"
  }
}
```

Créez aussi un `.gitignore` contenant au moins `node_modules/` et `.env`.

## Étape 2 — Récupérer le code de A06

Copiez depuis votre projet A06 (ou sa correction) :

| Depuis A06 | Vers le nouveau projet |
|---|---|
| `data/quizzes.json` | `data/quizzes.json` |
| `src/repositories/quiz.repository.js` | `src/repositories/quiz.repository.js` |
| `src/services/score.service.js` | `src/services/score.service.js` |

**Ne les modifiez pas.** Relisez-les plutôt :

- le repository exporte `findAll()`, `findById(id)` et `save(quiz)`, toutes `async`. Il calcule le chemin du fichier à partir de `__dirname` (`src/repositories/` → `../../data/quizzes.json`). Comme nous gardons la même arborescence, il fonctionne tel quel ;
- `computeScore(quiz, responses)` est une **fonction pure** : elle ne lit rien, n'écrit rien, n'affiche rien.

> 🔎 **Pourquoi ce code se réutilise-t-il sans retouche ?** Parce qu'il ne dépend **ni** de `readline`, **ni** de `console.log`, **ni** de HTTP. Il ne s'occupe que des données. C'est tout l'intérêt de séparer le code en couches : on change l'**interface** (CLI → API) sans toucher au **métier** ni au **stockage**.
>
> ❓ **Et `quiz-session.js` ?** La `QuizSession` de A03 pose les questions **une par une**, avec un chronomètre, et garde son état en mémoire entre deux réponses. Une API HTTP est **sans état** : le client envoie toutes ses réponses en une seule requête, et le serveur les corrige avec `computeScore`. C'était déjà ce que faisait `QuizSession` à la fin du quiz. Nous ne la reprenons donc pas, de même que la CLI.

## Étape 3 — Les erreurs métier

Créez `src/utils/errors.js`. Chaque erreur porte le **statut HTTP** à renvoyer :

```js
class AppError extends Error {
  constructor(message, status = 500, details = undefined) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.details = details;
  }
}

class ValidationError extends AppError {
  constructor(message, details) {
    super(message, 400, details);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Ressource introuvable') {
    super(message, 404);
  }
}

module.exports = { AppError, ValidationError, NotFoundError };
```

> 💡 Le service lèvera `new NotFoundError(...)` **sans rien savoir d'Express**. C'est le gestionnaire d'erreurs (étape 6) qui lira `error.status`.

## Étape 4 — Le service : les règles métier

Créez `src/services/quiz.service.js`. Il **s'appuie** sur le code de A06 et applique les règles des spécifications :

- seuls les quiz **publiés** sont visibles ; un brouillon est « introuvable » pour le public ;
- les bonnes réponses (`isCorrect`) ne sont **jamais** envoyées avant la soumission ;
- le score est calculé **par le serveur**.

```js
const quizRepository = require('../repositories/quiz.repository'); // A06
const { computeScore } = require('./score.service'); // A06
const { NotFoundError, ValidationError } = require('../utils/errors');

function toSummary(quiz) {
  return { id: quiz.id, title: quiz.title, description: quiz.description, questionCount: quiz.questions.length };
}

// Le quiz SANS le champ isCorrect
function toPublicQuiz(quiz) {
  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    questions: quiz.questions.map((q) => ({
      id: q.id,
      statement: q.statement,
      answers: q.answers.map((a) => ({ id: a.id, label: a.label })),
    })),
  };
}

async function findPublished(id) {
  const quiz = await quizRepository.findById(id);
  if (!quiz || !quiz.published) throw new NotFoundError(`Quiz ${id} introuvable`);
  return quiz;
}

async function listQuizzes() {
  const quizzes = await quizRepository.findAll();
  return quizzes.filter((q) => q.published).map(toSummary);
}

async function getQuiz(id) {
  return toPublicQuiz(await findPublished(id));
}
```

Écrivez vous-même `submitAnswers(id, answers)` :

1. si `answers` n'est pas un tableau : `ValidationError` (contrôle provisoire, remplacé par un validateur en E02) ;
2. retrouver le quiz **publié** ;
3. si une réponse cite une question qui n'appartient pas à ce quiz : `ValidationError` ;
4. renvoyer `{ quizId: quiz.id, ...computeScore(quiz, answers) }`.

> ⚠️ **On construit un nouvel objet** au lieu de supprimer `isCorrect` du quiz lu. Oublier un `delete` suffirait à divulguer les réponses. Une liste explicite des champs à envoyer est plus sûre : un champ ajouté plus tard ne partira pas par accident.

## Étape 5 — Le contrôleur et le routeur

Un **contrôleur** traduit : requête HTTP → appel au service → réponse HTTP. Il ne contient **aucune règle métier**. Créez `src/controllers/quiz.controller.js` :

```js
const quizService = require('../services/quiz.service');

async function list(req, res) {
  res.json(await quizService.listQuizzes());
}

async function getOne(req, res) {
  res.json(await quizService.getQuiz(Number(req.params.id)));
}

async function submit(req, res) {
  res.json(await quizService.submitAnswers(Number(req.params.id), req.body?.answers));
}

module.exports = { list, getOne, submit };
```

Puis `src/routes/quiz.routes.js` :

```js
const { Router } = require('express');
const controller = require('../controllers/quiz.controller');

const router = Router();

router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.post('/:id/submit', controller.submit);

module.exports = router;
```

| | |
|---|---|
| `res.json(data)` | envoie du JSON, avec `Content-Type` et `Content-Length` |
| `res.status(201)` | change le statut (chaînable : `res.status(201).json(...)`) |
| `req.params.id` | la valeur de `:id` dans l'URL, **toujours une chaîne** |
| `req.body` | le corps de la requête, rempli par `express.json()` |

> 🔎 **Express 5 et `async`** : si une fonction `async` lève une erreur (la `NotFoundError` de `getQuiz`, par exemple), Express 5 la transmet **automatiquement** au gestionnaire d'erreurs. Avec Express 4, il fallait un `try`/`catch` et `next(error)` dans chaque route.

## Étape 6 — L'application

Créez `src/app.js` :

```js
const express = require('express');
const quizRoutes = require('./routes/quiz.routes');
const { AppError } = require('./utils/errors');

const app = express();

app.use(express.json({ limit: '100kb' }));

app.get('/', (req, res) => {
  res.json({ name: 'EduTrack API', endpoints: { quizzes: '/api/quizzes' } });
});

app.use('/api/quizzes', quizRoutes);

app.use((req, res) => {
  res.status(404).json({ error: `Route introuvable : ${req.method} ${req.path}` });
});

app.use((error, req, res, next) => {
  if (error instanceof AppError) {
    return res.status(error.status).json({ error: error.message, details: error.details });
  }
  if (error.status === 400 || error.status === 413) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error(error);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

module.exports = app;
```

Chaque `app.use(...)` ajoute un **middleware** à une chaîne parcourue **dans l'ordre** pour chaque requête :

1. `express.json()` lit le corps JSON et le place dans `req.body`. Il renvoie une erreur 400 si le JSON est invalide, 413 au-delà de `limit` ;
2. `app.get('/', ...)` : une route déclarée directement sur l'application. Elle décrit l'API, pour que <http://localhost:3000/> réponde autre chose qu'une erreur ;
3. le routeur des quiz, **monté** sur `/api/quizzes` : sa route `'/:id'` répond donc à `/api/quizzes/:id` ;
4. si personne n'a répondu : 404 ;
5. le **gestionnaire d'erreurs**, reconnaissable à ses **quatre** paramètres `(error, req, res, next)`.

> ⚠️ **L'ordre compte.** Placé avant les routes, le middleware 404 répondrait « introuvable » à **toutes** les requêtes.
>
> 💡 Pour servir aussi des fichiers (HTML, images…), Express fournit le middleware `express.static('public')`. Nous n'en avons pas besoin : notre serveur est une API.

Enfin, `src/index.js` met l'application à l'écoute :

```js
const app = require('./app');

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`EduTrack écoute sur http://localhost:${port}`);
});
```

> 💡 Séparer `app.js` (l'application) de `index.js` (la mise à l'écoute) permettra de **tester** l'application sans ouvrir de port (jour 4, Supertest).

## Vérifications

> 🔁 **Scénario fetch** : [scripts/scenario.js](E01-creer-le-serveur-express/scripts/scenario.js) rejoue les principales étapes de l'atelier avec des appels `fetch` enchaînés par `.then()`. Serveur démarré dans un autre terminal, lancez `npm run scenario`.

```bash
npm run dev
```

Utilisez [requests.http](E01-creer-le-serveur-express/requests.http) (extension REST Client) ou `curl` :

| Requête | Attendu |
|---|---|
| `GET /api/quizzes` | 200, 16 quiz publiés (le quiz 2 est un brouillon) |
| `GET /api/quizzes/1` | 200, **aucun** `isCorrect` dans la réponse |
| `GET /api/quizzes/2` et `/999` | 404 |
| `POST /api/quizzes/1/submit` avec 2 bonnes réponses | 200, `score: 2`, `maxScore: 5`, `scoreOn20: 8` |
| `POST` avec un `questionId` d'un autre quiz | 400 |
| `POST` avec un JSON tronqué | 400 |
| `GET /api/inconnue` | 404 |
| `GET /` (ou <http://localhost:3000/> dans le navigateur) | 200, `{ "name": "EduTrack API", ... }` |

Observez aussi ce qui **ne va pas encore**. Nous le corrigerons en E02 :

| Requête | Obtenu | Problème |
|---|---|---|
| `GET /api/quizzes/abc` | 404 `Quiz NaN introuvable` | `:id` accepte n'importe quelle chaîne |
| `DELETE /api/quizzes` | 404 | la route existe : on attend 405 |
| POST avec `Content-Type: text/plain` | 400 `answers doit être un tableau` | on attend 415 : `express.json` **ignore** les corps non JSON |
| POST avec un JSON tronqué | message technique en anglais | message d'origine du *parser* |

## Récapitulatif

- Le code de A06 (repository, `computeScore`) passe d'une CLI à une API **sans modification**, parce qu'il ne dépend pas de l'interface.
- `express()` crée l'application ; `app.use` ajoute des **middlewares**, exécutés dans l'ordre.
- `Router` regroupe les routes d'une ressource ; `app.use('/api/quizzes', router)` les **monte** sous un préfixe.
- Routes → contrôleurs → services → repository : chaque couche a un rôle précis.
- Le gestionnaire d'erreurs a **4 paramètres** ; Express 5 y envoie les erreurs des fonctions `async`.

## Pour aller plus loin

- Ajoutez `GET /api/health`, qui renvoie `{ status: 'ok', uptime: process.uptime() }`.
- Que se passe-t-il si vous supprimez `data/quizzes.json` puis appelez `GET /api/quizzes` ? Quelle couche lève l'erreur, et laquelle la transforme en 500 ?
- Lisez les différences entre Express 4 et 5 : <https://expressjs.com/en/guide/migrating-5.html>.
