# Atelier E06 — Configurer TypeORM et modéliser les entités

| | |
|---|---|
| **Jour** | 4 |
| **Durée** | 1 heure |
| **Chapitre associé** | 14 — ORM TypeORM : entités et relations |
| **Point de départ** | votre projet à l'issue de E05 (ou [E05-connecter-sqlite/](E05-connecter-sqlite/)) |
| **Correction** | [E06-typeorm-et-entites/](E06-typeorm-et-entites/) |

## Objectifs

- Comprendre le rôle d'un **ORM** (*Object-Relational Mapping*).
- Configurer une connexion TypeORM : le **`DataSource`**.
- Décrire les tables avec des **entités** (`EntitySchema`) : colonnes, contraintes, **relations**.
- Laisser TypeORM créer les tables (`synchronize`).
- Migrer les **utilisateurs** vers la base, sans toucher au service d'authentification.

## Contexte

En E05, nous avons écrit le SQL à la main. Un ORM permet de manipuler la base avec des **objets JavaScript** : il génère le SQL, toujours paramétré, et convertit les lignes en objets, relations comprises.

Cet atelier pose les fondations : les quatre entités du modèle de données et la connexion. Les **utilisateurs** passent en base dès maintenant ; les **quiz** suivront en E07.

```text
User          Quiz 1 ──── * Question 1 ──── * Answer
```

```text
edutrack-express/
├── data/edutrack.db                  ★ créé par le seed (non versionné)
├── scripts/seed.js                   ✎ comptes créés en base
├── src/
│   ├── config/
│   │   ├── database.js               ★ le DataSource
│   │   └── index.js                  ✎ dbPath
│   ├── entities/                     ★ User.js, Quiz.js, Question.js, Answer.js
│   ├── index.js                      ✎ connexion à la base avant l'écoute
│   └── repositories/
│       └── user.repository.js        ✎ réécrit avec TypeORM
├── .env.example                      ✎ DB_PATH
└── .gitignore                        ✎ data/users.json retiré, data/*.db ajouté
```

---

## Étape 1 — Installer TypeORM

```bash
npm install typeorm@1
```

Ajoutez l'emplacement de la base à la configuration (`src/config/index.js`) :

```js
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..'); // dossier racine du projet

module.exports = {
  // ... env, port, corsOrigins, jwtSecret, jwtExpiresIn : inchangés
  dbPath: process.env.DB_PATH ?? path.join(ROOT, 'data', 'edutrack.db'),
};
```

Ajoutez `DB_PATH=data/edutrack.db` à `.env.example` et à votre `.env`, et la ligne `data/*.db` au `.gitignore` : la base se recrée avec `npm run seed`, elle n'a pas à être versionnée.

## Étape 2 — Les entités

Une **entité** décrit une table. Nous utilisons `EntitySchema`, qui s'écrit en JavaScript pur. En TypeScript, on écrirait plutôt des classes avec des décorateurs (`@Entity`, `@Column`…).

Créez `src/entities/User.js` :

```js
const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'User',
  tableName: 'users',
  columns: {
    id: { type: 'integer', primary: true, generated: true },
    email: { type: 'varchar', length: 255, unique: true },
    passwordHash: { type: 'varchar', length: 255 },
    name: { type: 'varchar', length: 100 },
    role: { type: 'varchar', length: 20 },
  },
  checks: [{ expression: `role IN ('trainer', 'student')` }],
});
```

Puis `Quiz.js`, avec sa relation vers les questions :

```js
module.exports = new EntitySchema({
  name: 'Quiz',
  tableName: 'quizzes',
  columns: {
    id: { type: 'integer', primary: true, generated: true },
    title: { type: 'varchar', length: 120 },
    description: { type: 'text', default: '' },
    published: { type: 'boolean', default: false },
    createdAt: { type: 'datetime', createDate: true },
  },
  relations: {
    questions: { type: 'one-to-many', target: 'Question', inverseSide: 'quiz', cascade: true },
  },
});
```

Et `Question.js`, le côté qui porte la **clé étrangère** :

```js
columns: {
  id: { type: 'integer', primary: true, generated: true },
  statement: { type: 'text' },
  position: { type: 'integer' },
  quizId: { type: 'integer' },
},
relations: {
  quiz: {
    type: 'many-to-one',
    target: 'Quiz',
    inverseSide: 'questions',
    joinColumn: { name: 'quizId' },
    nullable: false,
    onDelete: 'CASCADE',
  },
  answers: { type: 'one-to-many', target: 'Answer', inverseSide: 'question', cascade: true },
},
```

Écrivez `Answer.js` sur le même modèle : `label`, `isCorrect` (booléen, `false` par défaut), `questionId`, et la relation `question`. Les quatre entités sont dans le dossier [src/entities/](E06-typeorm-et-entites/src/entities/) de la correction.

| Notion | Signification |
|---|---|
| `generated: true` | identifiant attribué par la base (auto-incrément) |
| `createDate: true` | date remplie automatiquement à l'insertion |
| `one-to-many` / `many-to-one` | les deux côtés d'une même relation « un quiz → plusieurs questions » |
| `joinColumn` | la colonne qui porte la clé étrangère (côté *many-to-one*) |
| `cascade: true` | enregistrer un quiz enregistre aussi ses questions et ses réponses (E07) |
| `onDelete: 'CASCADE'` | supprimer un quiz supprime ses questions (`ON DELETE CASCADE` de E05) |
| `position` | les questions doivent garder leur **ordre** : en SQL, l'ordre des lignes n'est jamais garanti sans `ORDER BY` |

## Étape 3 — Le DataSource

Créez `src/config/database.js` :

```js
const { DataSource } = require('typeorm');
const config = require('./index');
// ... require des 4 entités

const AppDataSource = new DataSource({
  type: 'better-sqlite3', // le pilote installé en E05
  database: config.dbPath,
  entities: [User, Quiz, Question, Answer],
  synchronize: true,
  logging: false,
});

module.exports = { AppDataSource };
```

> ⚠️ **`synchronize: true`** crée ou modifie les tables à chaque démarrage pour qu'elles correspondent aux entités. C'est parfait pour apprendre et développer, mais **interdit en production** : renommer un champ peut **supprimer une colonne et ses données**. En production, on utilise des **migrations** (des scripts SQL versionnés et relus).
>
> 💡 Passez `logging: true` pour voir chaque requête SQL générée par TypeORM : c'est très instructif.

## Étape 4 — Se connecter au démarrage

Dans `src/index.js`, placez le démarrage dans une fonction `async function main()` et connectez-vous **avant** d'écouter :

```js
async function main() {
  if (!config.jwtSecret) {
    throw new Error('JWT_SECRET manquant : copiez .env.example en .env et renseignez-le.');
  }
  await AppDataSource.initialize();
  console.log(`Base de données : ${config.dbPath}`);
  app.listen(config.port, () => { /* ... */ });
}

main().catch((error) => {
  console.error('❌ Démarrage impossible :', error.message);
  process.exit(1);
});
```

> 🔎 Le contrôle de `JWT_SECRET` (E04) devient un `throw` : toutes les erreurs de démarrage passent par le même `catch`.

## Étape 5 — Le repository des utilisateurs

Réécrivez `src/repositories/user.repository.js` avec **la même interface** :

```js
const { AppDataSource } = require('../config/database');

const users = () => AppDataSource.getRepository('User');

async function findByEmail(email) {
  return users().findOneBy({ email: email.toLowerCase() });
}

async function findById(id) {
  return users().findOneBy({ id });
}

async function create(data) {
  return users().save(data);
}

module.exports = { findByEmail, findById, create };
```

> 🎯 **Le service d'authentification ne change pas d'une ligne.** Il appelle toujours `findByEmail` et `findById` : il ignore que les données viennent maintenant d'une base. C'est la promesse du découpage en couches (E01) qui se réalise.
>
> 🔎 `users()` est une fonction, et non une constante, car le repository TypeORM n'est disponible **qu'après** `initialize()`.

## Étape 6 — Le seed

`scripts/seed.js` crée maintenant les comptes **dans la base** :

```js
// 1. Les quiz (encore en JSON) : copie de seed-quizzes.json, inchangée

// 2. Les utilisateurs, dans la base
if (!(await mustCreate(config.dbPath))) return; // --if-missing : la base existe déjà

await AppDataSource.initialize();
await AppDataSource.synchronize(true); // supprime puis recrée toutes les tables

for (const { password, ...user } of DEMO_USERS) {
  await userRepository.create({ ...user, passwordHash: await hashPassword(password) });
}
```

Terminez par `AppDataSource.destroy()` dans un `finally` : une connexion ouverte empêche le script de s'arrêter (voir la [correction](E06-typeorm-et-entites/scripts/seed.js)). Supprimez `data/users.json` et sa ligne du `.gitignore`.

> 💡 Avec `--if-missing` (scripts `predev` et `prestart`), la base n'est créée que si le fichier `data/edutrack.db` n'existe pas encore. `npm run seed`, lui, la remet **toujours** à zéro.

## Vérifications

> 🔁 **Scénario fetch** : [scripts/scenario.js](E06-typeorm-et-entites/scripts/scenario.js) rejoue les principales étapes de l'atelier avec des appels `fetch` enchaînés par `.then()`. Serveur démarré dans un autre terminal, lancez `npm run scenario`.

```bash
npm run seed     # ✅ 3 comptes créés dans .../data/edutrack.db
npm run dev      # Base de données : ... puis EduTrack écoute sur ...
```

| Vérification | Résultat attendu |
|---|---|
| ouvrir `data/edutrack.db` avec **SQLite Viewer** | 4 tables ; 3 lignes dans `users`, mots de passe hachés |
| connexion `formateur@edutrack.local` | 200 + jeton (le compte vient de la base) |
| connexion avec `Formateur@EduTrack.local` | 200 (e-mail mis en minuscules) |
| mauvais mot de passe | 401 |
| `GET /api/auth/me` avec le jeton | 200, sans `passwordHash` |
| les routes des quiz | inchangées (toujours en JSON) |
| `logging: true`, puis une connexion | la requête `SELECT ... WHERE "email" = ?` s'affiche |

## Récapitulatif

- Un **ORM** traduit objets ⇄ tables et génère un SQL paramétré.
- Le **DataSource** décrit la connexion ; `initialize()` l'ouvre, `destroy()` la ferme.
- Les **entités** décrivent colonnes, contraintes et relations (`one-to-many` / `many-to-one`).
- `synchronize` est réservé au développement ; en production, on utilise des **migrations**.
- Changer de stockage n'impose de modifier **que** le repository.

## Pour aller plus loin

- Ajoutez une colonne `createdAt` (avec `createDate: true`) aux utilisateurs, et observez la table après redémarrage.
- Générez une migration avec la CLI de TypeORM et lisez le SQL produit.
- Comparez avec **Prisma** ou **Sequelize**, deux autres ORM populaires de l'écosystème Node.js.
