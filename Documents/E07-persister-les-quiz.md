# Atelier E07 — Persister les quiz avec TypeORM

| | |
|---|---|
| **Jour** | 4 |
| **Durée** | 45 minutes |
| **Chapitre associé** | 14 — ORM TypeORM : entités et relations |
| **Point de départ** | votre projet à l'issue de E06 (ou [E06-typeorm-et-entites/](E06-typeorm-et-entites/)) |
| **Correction** | [E07-persister-les-quiz/](E07-persister-les-quiz/) |

## Objectifs

- Lire des données **avec leurs relations** (`relations`) et **dans un ordre garanti** (`order`).
- Enregistrer un objet et ses enfants en une opération grâce aux **cascades**.
- Utiliser une **transaction** explicite (`AppDataSource.transaction`).
- Remplacer le stockage JSON des quiz **sans modifier** les routes ni les contrôleurs.

## Contexte

Les quiz quittent `data/quizzes.json` pour la base. Le repository garde **exactement la même interface** : `findAll`, `findById`, `save`, `create`, `remove`. Le reste de l'application ne s'en aperçoit pas. Seule une ligne du service disparaît : la date de création est désormais remplie par la base.

```text
edutrack-express/
├── data/
│   ├── seed-quizzes.json               (inchangé : les données de référence)
│   └── quizzes.json                    ✖ supprimé
├── scripts/seed.js                     ✎ importe les quiz en base, dans une transaction
├── src/
│   ├── repositories/quiz.repository.js ✎ réécrit avec TypeORM
│   └── services/quiz.service.js        ✎ createdAt retiré de createQuiz
└── .gitignore                          ✎ data/quizzes.json retiré
```

---

## Étape 1 — Lire les quiz avec leurs relations

Réécrivez `src/repositories/quiz.repository.js` :

```js
const { AppDataSource } = require('../config/database');

const quizzes = () => AppDataSource.getRepository('Quiz');

const WITH_QUESTIONS = {
  relations: { questions: { answers: true } },
  order: { id: 'ASC', questions: { position: 'ASC', answers: { id: 'ASC' } } },
};

async function findAll() {
  return quizzes().find(WITH_QUESTIONS);
}

async function findById(id) {
  return quizzes().findOne({ where: { id }, ...WITH_QUESTIONS });
}
```

> 🔎 **`relations`** : par défaut, TypeORM ne charge **que** la table demandée. `{ questions: { answers: true } }` demande les questions **et** leurs réponses : TypeORM génère les jointures (`LEFT JOIN`) et reconstruit les objets imbriqués, exactement comme dans notre ancien JSON.
>
> ⚠️ **`order`** : sans `ORDER BY`, une base ne garantit **aucun** ordre. Les questions seraient affichées dans un ordre imprévisible. C'est pour cela que nous avons une colonne `position`.

## Étape 2 — Créer, modifier, supprimer

```js
async function save(quiz) {
  return quizzes().save(quiz);
}

async function create(data, manager = AppDataSource.manager) {
  const repository = manager.getRepository('Quiz');
  const saved = await repository.save({
    ...data,
    questions: data.questions.map((question, index) => ({ ...question, position: index + 1 })),
  });
  return repository.findOne({ where: { id: saved.id }, ...WITH_QUESTIONS });
}

async function remove(id) {
  const result = await quizzes().delete(id);
  return result.affected > 0;
}

module.exports = { findAll, findById, save, create, remove };
```

> 🔎 **La cascade.** Un seul `save` d'un quiz qui contient des questions, qui contiennent des réponses : grâce à `cascade: true` (entités Quiz et Question), TypeORM insère tout, dans le bon ordre. D'abord le quiz, pour connaître son `id`, puis les questions avec ce `quizId`, puis les réponses. Fini notre fonction `maxId` de E02 : c'est la base qui attribue les identifiants.
>
> 🔎 **Une transaction implicite.** `save` avec cascade s'exécute dans une transaction : si l'insertion d'une réponse échoue, le quiz et les questions déjà insérés sont **annulés**.
>
> 💡 **`manager`** : le paramètre facultatif permet d'exécuter `create` à l'intérieur d'une transaction plus large (étape 4). Par défaut, c'est le gestionnaire global de la connexion.
>
> 💡 **`delete`** supprime la ligne du quiz ; les questions et les réponses suivent grâce à `onDelete: 'CASCADE'`.

## Étape 3 — Le service

Dans `createQuiz`, supprimez la ligne `createdAt: new Date().toISOString()` : la colonne `createdAt` (`createDate: true`) est remplie **par la base**. C'est la seule modification du service.

> 🎯 `updateQuiz` appelle toujours `quizRepository.save(quiz)` : la même ligne qu'avec le fichier JSON produit maintenant un `UPDATE` en base.

## Étape 4 — Le seed, en une transaction

Le seed importe les 17 quiz de `data/seed-quizzes.json`. On veut du **tout ou rien** : si le 12ᵉ quiz est invalide, aucun ne doit être importé.

```js
const data = JSON.parse(await fs.readFile(SEED_FILE, 'utf8'));

await AppDataSource.transaction(async (manager) => {
  for (const quiz of data) {
    await quizRepository.create(
      {
        title: quiz.title,
        description: quiz.description,
        published: quiz.published,
        createdAt: new Date(quiz.createdAt),
        questions: quiz.questions.map((q) => ({
          statement: q.statement,
          answers: q.answers.map((a) => ({ label: a.label, isCorrect: a.isCorrect })),
        })),
      },
      manager, // ← toutes les écritures passent par la transaction
    );
  }
});
```

> 🔎 `AppDataSource.transaction(fn)` ouvre une transaction et appelle `fn` avec un **`manager`** qui lui est attaché. Si `fn` lève une erreur, tout est annulé (`ROLLBACK`) ; sinon, tout est validé (`COMMIT`).
>
> ⚠️ **Piège classique :** dans la transaction, il faut écrire **avec `manager`**. Une écriture faite avec `AppDataSource.getRepository(...)` passerait **hors** de la transaction et ne serait pas annulée.
>
> 💡 On retire les `id` du fichier : c'est la base qui les attribue. Comme on insère dans le même ordre, les identifiants obtenus sont les mêmes qu'avant.

La copie de `seed-quizzes.json` vers `quizzes.json` disparaît : avec `--if-missing`, le seed ne fait plus rien si la base existe déjà (voir la [correction](E07-persister-les-quiz/scripts/seed.js)). Supprimez `data/quizzes.json` et sa ligne du `.gitignore`.

## Vérifications

> 🔁 **Scénario fetch** : [scripts/scenario.js](E07-persister-les-quiz/scripts/scenario.js) rejoue les principales étapes de l'atelier avec des appels `fetch` enchaînés par `.then()`. Serveur démarré dans un autre terminal, lancez `npm run scenario`.

```bash
npm run seed     # ✅ 3 comptes créés, ✅ 17 quiz importés
npm run dev
```

| Vérification | Résultat attendu |
|---|---|
| `GET /api/quizzes` | 16 quiz publiés, comme avant |
| `GET /api/quizzes/1` | les 5 questions dans l'ordre, sans `isCorrect` |
| `POST /api/quizzes/1/submit` | 200, score calculé comme avant |
| création d'un quiz à 3 questions (formateur) | 201, avec un `createdAt` rempli par la base ; `GET` renvoie les questions dans l'ordre de création |
| suppression du quiz créé | 204 ; ses questions ont disparu de la table `questions` |
| **arrêter puis relancer le serveur** | les quiz créés sont toujours là |
| SQLite Viewer sur `data/edutrack.db` | 17 quiz, 157 questions, 621 réponses après le seed |

Toutes les requêtes de [requests.http](E07-persister-les-quiz/requests.http) doivent donner les mêmes résultats qu'en E04.

## Récapitulatif

- `find` / `findOne` + **`relations`** chargent un objet et ses enfants ; **`order`** garantit l'ordre.
- `save` + **`cascade`** enregistre un arbre d'objets en une opération, dans une transaction implicite.
- `AppDataSource.transaction(async (manager) => ...)` regroupe plusieurs opérations en « tout ou rien ».
- Grâce au découpage en couches, passer des fichiers JSON à une base de données n'a presque pas touché au reste du code.

## Pour aller plus loin

- Activez `logging: true` dans le `DataSource` et observez les requêtes d'un `GET /api/quizzes/1`, puis d'un `POST` : repérez `BEGIN TRANSACTION` et `COMMIT`.
- Ajoutez volontairement une réponse au libellé vide (`label: null`) au 12ᵉ quiz de `seed-quizzes.json`, lancez `npm run seed` et vérifiez qu'**aucun** quiz n'a été importé. Remettez le fichier en état.
- `findAll` charge toutes les réponses de tous les quiz, juste pour compter les questions. Utilisez le *QueryBuilder* et `loadRelationCountAndMap` pour ne charger que les nombres.
