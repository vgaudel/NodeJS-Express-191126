# Atelier E08 — Tester EduTrack avec Mocha, Chai et Supertest

| | |
|---|---|
| **Jour** | 4 |
| **Durée** | 50 minutes |
| **Chapitre associé** | 15 — Tests avec Mocha et Chai |
| **Point de départ** | votre projet à l'issue de E07 (ou [E07-persister-les-quiz/](E07-persister-les-quiz/)) |
| **Correction** | [E08-tests-mocha-chai/](E08-tests-mocha-chai/) |

## Objectifs

- Écrire des **tests unitaires** (fonctions pures) et des **tests d'intégration** (API complète).
- Structurer les tests avec **Mocha** : `describe`, `it`, hooks.
- Exprimer les attentes avec **Chai** (`expect`).
- Tester l'API **sans démarrer de serveur**, avec **Supertest**.
- Isoler les tests grâce à une **base en mémoire**, recréée avant chaque test.

## Contexte

Chaque atelier s'est terminé par des vérifications **manuelles** : `requests.http`, scénario `fetch`, curl. Elles sont longues à refaire et on en oublie. Des tests **automatisés** rejouent tout en une seconde, à chaque modification.

```text
edutrack-express/
├── .mocharc.json                   ★ configuration de Mocha
├── tests/
│   ├── setup.js                    ★ base en mémoire, hooks communs
│   ├── helpers.js                  ★ données de test, jetons
│   ├── unit/
│   │   ├── score.test.js           ★ computeScore
│   │   └── quiz.validator.test.js  ★ validateurs
│   └── api/
│       ├── auth.api.test.js        ★ connexion, profil
│       ├── quizzes.public.test.js  ★ consulter et passer un quiz
│       └── quizzes.trainer.test.js ★ créer, modifier, supprimer
└── package.json                    ✎ "test": "mocha" ; mocha, chai, supertest
```

| | Test unitaire | Test d'intégration |
|---|---|---|
| Teste | une fonction, seule | l'application entière : routes → middlewares → services → base |
| Exemple | `computeScore(quiz, réponses)` | `POST /api/quizzes/1/submit` → 200 + score |
| Vitesse | instantané | quelques millisecondes |
| Détecte | une erreur de calcul | une route mal protégée, un middleware oublié… |

### Mocha : le lanceur de tests

**Mocha** trouve les fichiers de test, les exécute et affiche le bilan : ✔ pour un test réussi, le détail de l'erreur pour un test qui échoue. Il fournit la **structure** des tests, sans rien vérifier lui-même :

```js
describe('computeScore', () => {          // un groupe de tests (souvent : une fonction, une route)
  beforeEach(() => { /* ... */ });        // hook : exécuté avant CHAQUE test du groupe
  it('donne 20/20 si tout est juste', () => {
    // un test : il réussit s'il se termine sans lever d'erreur
  });
});
```

| Mocha | Rôle |
|---|---|
| `describe(nom, fn)` | regroupe des tests ; les groupes peuvent s'imbriquer |
| `it(nom, fn)` | un test. Son nom se lit comme une phrase : « *it* donne 20/20 si tout est juste » |
| `before` / `after` | hooks exécutés une fois, avant / après tous les tests du groupe |
| `beforeEach` / `afterEach` | hooks exécutés avant / après **chaque** test |
| `async () => { ... }` | test asynchrone : Mocha **attend** la Promise avant de passer au test suivant |

> 🔎 La règle de Mocha est simple : un test **échoue** s'il lève une erreur (ou si sa Promise est rejetée), il **réussit** sinon. Il faut donc un outil qui lève une erreur quand une valeur n'est pas celle attendue : c'est le rôle de Chai.

### Chai : la bibliothèque d'assertions

Une **assertion** affirme ce qui doit être vrai : « le score vaut 2 ». **Chai** vérifie l'affirmation et lève une erreur, avec un message clair, si elle est fausse. Son style `expect` se lit presque comme une phrase en anglais :

```js
const { expect } = require('chai');

expect(result.score).to.equal(2);
// si score vaut 1 → AssertionError: expected 1 to equal 2
```

Les mots `to`, `be`, `have`… ne font rien : ils servent seulement à rendre l'assertion lisible. Les assertions utiles sont présentées à l'étape 4.

> 💡 Node.js fournit aussi le module `node:assert` (`assert.strictEqual(result.score, 2)`). Chai offre plus d'assertions et des messages d'erreur plus parlants, mais le principe est le même : lever une erreur si l'attente n'est pas satisfaite.

---

## Étape 1 — Installer et configurer

```bash
npm install -D mocha chai supertest
```

> 💡 `-D` (`--save-dev`) : ces paquets ne servent qu'au développement. Ils vont dans `devDependencies` et ne sont pas installés en production (`npm install --omit=dev`).

Créez `.mocharc.json` à la racine :

```json
{
  "spec": "tests/**/*.test.js",
  "require": "tests/setup.js",
  "timeout": 10000
}
```

Et dans `package.json` : `"test": "mocha"`.

## Étape 2 — Une base de test isolée

Créez `tests/setup.js`, chargé **avant** tous les tests :

```js
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'secret-reserve-aux-tests';

const { AppDataSource } = require('../src/config/database');
const { loadFixtures } = require('./helpers');

exports.mochaHooks = {
  async beforeAll() {
    await AppDataSource.initialize();
  },
  async beforeEach() {
    await AppDataSource.synchronize(true);
    await loadFixtures();
  },
  async afterAll() {
    await AppDataSource.destroy();
  },
};
```

> 🔎 **Les variables d'environnement d'abord.** `src/config` lit `process.env` **au moment où il est chargé**, puis reste en cache (un module n'est exécuté qu'une fois). Il faut donc les définir **avant** le premier `require` de l'application.
>
> 🔎 **`:memory:`** : la base de test vit en mémoire. Elle est rapide, jetable, et ne touche **jamais** à `data/edutrack.db`.
>
> 🔎 **`beforeEach`** : avant **chaque** test, la base est vidée puis remplie avec les mêmes données. Les tests sont **indépendants** : l'ordre d'exécution n'a aucune importance, et un test qui supprime un quiz ne gêne pas le suivant.
>
> 💡 `NODE_ENV=test` désactive aussi Morgan (voir `app.js`, E03) : le journal des requêtes ne pollue pas la sortie des tests.

## Étape 3 — Des données connues

Créez `tests/helpers.js` (voir la [correction](E08-tests-mocha-chai/tests/helpers.js)). Il fournit :

- `loadFixtures()` : 1 formateur et 1 apprenant ; un quiz **publié** (questions 1 et 2, bonnes réponses 1 et 3) et un **brouillon** (question 3) ;
- `IDS` : les identifiants correspondants, connus d'avance puisque la base est recréée à chaque fois ;
- `auth` : des en-têtes `Authorization` prêts à l'emploi, avec des jetons **fabriqués directement** par `jwt.sign` (plus rapide que d'appeler `/login` à chaque test) ;
- `validQuiz(overrides)` : un quiz valide, modifiable selon le besoin.

> 💡 Le hachage du mot de passe (scrypt, volontairement lent) n'est calculé **qu'une fois**, grâce à `passwordHash ??= await hashPassword(PASSWORD)`.
>
> 🎯 `loadFixtures` utilise les **repositories** de E06 et E07 : `userRepository.create` et `quizRepository.create`. Les tests ne contiennent aucun SQL.

## Étape 4 — Les tests unitaires

`tests/unit/score.test.js` :

```js
const { expect } = require('chai');
const { computeScore } = require('../../src/services/score.service');

const quiz = {
  questions: [
    { id: 1, answers: [{ id: 10, isCorrect: true }, { id: 11, isCorrect: false }] },
    { id: 2, answers: [{ id: 20, isCorrect: false }, { id: 21, isCorrect: true }] },
  ],
};

describe('computeScore', () => {
  it('donne 2/2, soit 20/20, quand toutes les réponses sont correctes', () => {
    const result = computeScore(quiz, [
      { questionId: 1, answerId: 10 },
      { questionId: 2, answerId: 21 },
    ]);
    expect(result).to.include({ score: 2, maxScore: 2, scoreOn20: 20 });
  });

  it('compte faux une question sans réponse', () => { /* ... */ });
  it('arrondit la note sur 20 à deux décimales', () => { /* 1/3 → 6.67 */ });
});
```

Écrivez de même `tests/unit/quiz.validator.test.js` : un quiz valide n'a **aucune** erreur ; un titre trop court, zéro question, deux bonnes réponses ou une seule réponse produisent l'erreur attendue ; `validateQuizUpdate({ id: 2 })` refuse un champ non modifiable.

| Chai | Vérifie |
|---|---|
| `expect(x).to.equal(5)` | égalité stricte (`===`) |
| `expect(obj).to.deep.equal({...})` | même contenu, en profondeur |
| `expect(obj).to.include({ a: 1 })` | contient au moins ces propriétés |
| `expect(arr).to.have.lengthOf(2)` | taille |
| `expect(arr).to.be.empty` | tableau ou chaîne vide |
| `expect(obj).to.have.all.keys('id', 'label')` | **exactement** ces clés |
| `expect(obj).to.not.have.property('x')` | absence d'une propriété |

> 🎯 **Les fonctions pures se testent sans rien préparer** : ni base, ni serveur. C'est la récompense d'avoir écrit `computeScore` et les validateurs (E02) sans dépendre d'Express ni du stockage.

## Étape 5 — Les tests d'intégration avec Supertest

```js
const request = require('supertest');
const app = require('../../src/app');

it("n'envoie jamais les bonnes réponses à un apprenant", async () => {
  const res = await request(app).get('/api/quizzes/1').expect(200);
  expect(res.body.questions[0].answers[0]).to.have.all.keys('id', 'label');
});

it('calcule le score côté serveur et ignore un score envoyé par le client', async () => {
  const res = await request(app)
    .post('/api/quizzes/1/submit')
    .send({ score: 20, answers: [{ questionId: 1, answerId: 1 }, { questionId: 2, answerId: 4 }] })
    .expect(200);
  expect(res.body).to.include({ score: 1, maxScore: 2, scoreOn20: 10 });
});
```

| Supertest | Rôle |
|---|---|
| `request(app).get(url)` / `.post(url)`… | prépare la requête, **sans ouvrir de port** |
| `.set('Authorization', auth.trainer)` | ajoute un en-tête |
| `.send(objet)` | corps JSON (`Content-Type` automatique) |
| `.expect(201)` | vérifie le statut |
| `.expect('Location', /regex/)` | vérifie un en-tête |
| `res.body` / `res.text` | le corps de la réponse (JSON décodé / texte brut) |

> 🎯 **Pourquoi `app.js` et `index.js` sont séparés (E01)** : Supertest a besoin de l'application **sans** `listen`. Et comme la connexion à la base est ouverte dans `index.js` (E06), les tests ouvrent la leur, en mémoire, dans `setup.js`.

Écrivez les trois fichiers de `tests/api/`. Pour chaque règle de sécurité, testez le cas **autorisé et le cas interdit** :

| Fichier | Cas à couvrir |
|---|---|
| `auth.api.test.js` | connexion (200, jeton, **pas** de `passwordHash`) ; e-mail en majuscules (200) ; mauvais mot de passe (401) ; champs manquants (400) ; `/me` avec et sans jeton |
| `quizzes.public.test.js` | seuls les quiz publiés sont listés, sauf pour un formateur ; pas de `isCorrect` ; brouillon 404 pour le public, 200 pour un formateur ; identifiant invalide (400) ; score calculé par le serveur ; question d'un autre quiz (400) ; brouillon (404) ; `text/plain` (415) |
| `quizzes.trainer.test.js` | 401 / 403 / 201 à la création ; `id` envoyé par le client ignoré ; `createdAt` rempli par la base ; **ordre des questions** conservé ; détails des erreurs (400) ; publication ; 403 pour un apprenant ; champ non modifiable (400) ; suppression, questions supprimées en cascade, puis 404 ; 405 + `Allow` |

> 💡 Un test peut aussi interroger la base directement : `AppDataSource.getRepository('Question').countBy({ quizId: 1 })` vérifie que la suppression d'un quiz a bien emporté ses questions (`ON DELETE CASCADE`, E06).

## Vérifications

```bash
npm test
```

```text
  37 passing (0.6s)
```

**Les tests protègent-ils vraiment ?** Faites l'expérience :

1. Dans `src/routes/quiz.routes.js`, retirez `trainerOnly` de la route `.patch(...)`. Relancez `npm test` : le test du **403 pour un apprenant** échoue.
2. Dans `toPublicQuiz` (service), renvoyez `answers: q.answers` (avec `isCorrect`). Relancez : un test échoue.
3. Remettez le code d'origine : 37 tests au vert.

Un test qui ne peut jamais échouer ne sert à rien. Vérifier qu'il **détecte** le bug qu'il est censé détecter est une excellente habitude.

Vérifiez aussi que `data/edutrack.db` n'a pas été modifié par les tests.

## Récapitulatif

- **Mocha** organise (`describe`, `it`, hooks), **Chai** vérifie (`expect`), **Supertest** interroge l'API sans serveur.
- **Tests unitaires** pour les fonctions pures ; **tests d'intégration** pour les routes et la sécurité.
- **Base en mémoire recréée avant chaque test** : tests rapides, isolés et reproductibles.
- Chaque règle de sécurité mérite **deux** tests : l'accès autorisé et l'accès refusé.

## Pour aller plus loin

- Mesurez la **couverture** de code avec `npx c8 npm test`. Quelles lignes ne sont jamais exécutées par les tests ?
- Lancez les tests en continu pendant que vous codez : `npx mocha --watch`.
- Ajoutez un test pour le 413 de `express.json` (un corps de 150 Ko construit avec `'x'.repeat(150 * 1024)`).
- Comparez avec le lanceur de tests **intégré à Node.js** : `node --test` et le module `node:test`.

## Et ensuite ?

L'API EduTrack est complète et testée : consultation, gestion des quiz, authentification et rôles, données en base SQLite. Le découpage en couches a tenu sa promesse : passer des fichiers JSON à une base de données n'a modifié que les **repositories**, le seed et le démarrage. Les routes, les middlewares, les validateurs et les contrôleurs n'ont pas changé.
