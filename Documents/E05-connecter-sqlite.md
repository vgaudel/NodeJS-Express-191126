# Atelier E05 — Connecter une base SQLite

| | |
|---|---|
| **Jour** | 4 |
| **Durée** | 40 minutes |
| **Chapitre associé** | 13 — Connexion aux bases de données SQL et NoSQL |
| **Point de départ** | votre projet à l'issue de E04 (ou [E04-authentification-et-autorisation/](E04-authentification-et-autorisation/)) |
| **Correction** | [E05-connecter-sqlite/](E05-connecter-sqlite/) |

## Objectifs

- Installer un **pilote** de base de données et ouvrir une connexion.
- Créer des tables avec des **contraintes** (`NOT NULL`, `UNIQUE`, `CHECK`, clé étrangère).
- Exécuter des **requêtes préparées** avec des **paramètres**.
- Comprendre et **démontrer l'injection SQL**.
- Garantir le « tout ou rien » avec une **transaction**.

## Contexte

Nos fichiers JSON ont atteint leurs limites. Chaque écriture relit et réécrit **tout** le fichier ; deux écritures simultanées peuvent s'écraser ; aucune règle n'empêche d'enregistrer des données incohérentes. Une base de données règle ces trois problèmes.

Nous utilisons **SQLite** : une base complète, stockée dans **un seul fichier**, sans serveur à installer. Avant de brancher l'API sur la base (E06 et E07), cet atelier découvre SQL dans un **script autonome**.

```text
edutrack-express/
├── scripts/
│   └── sql-demo.js    ★ démonstration SQL pas à pas
└── package.json       ✎ dépendance better-sqlite3 ; script demo:sql
```

### Qu'est-ce que SQLite ?

**SQLite** est une base de données **relationnelle** : les données sont rangées dans des **tables** (des lignes et des colonnes), reliées entre elles par des **clés**, et on les interroge en **SQL**, comme avec PostgreSQL ou MySQL.

Sa particularité : **il n'y a pas de serveur**. Avec PostgreSQL ou MySQL, la base est un programme à part, installé et démarré séparément, auquel l'application se connecte par le réseau. SQLite, lui, est une **bibliothèque** chargée directement dans notre processus Node.js. La base entière (tables, index, données) tient dans **un seul fichier** sur le disque, par exemple `data/edutrack.db`.

```text
PostgreSQL / MySQL                          SQLite
┌──────────────┐   réseau   ┌──────────┐    ┌───────────────────────────┐
│ API Node.js  │ ─────────► │ serveur  │    │ API Node.js               │
└──────────────┘            │ de base  │    │  └─ bibliothèque SQLite ──┼──► data/edutrack.db
                            └──────────┘    └───────────────────────────┘
```

| | SQLite | PostgreSQL, MySQL |
|---|---|---|
| Installation | rien à installer : `npm install better-sqlite3` suffit | un serveur à installer, configurer et démarrer |
| Stockage | un seul fichier, facile à copier ou à supprimer | des fichiers gérés par le serveur |
| Accès simultanés | plusieurs lectures en même temps, mais **une seule écriture à la fois** : les autres attendent leur tour | de nombreux clients lisent et écrivent en même temps, à travers le réseau |
| Comptes et droits | aucun : qui peut lire le fichier peut lire la base | utilisateurs, mots de passe, droits par table |
| Usage typique | applications mobiles et de bureau, navigateurs, prototypes, tests, petits sites | applications web à fort trafic, données partagées entre plusieurs serveurs |

SQLite n'est pas pour autant une base « au rabais » : il gère les **contraintes**, les **jointures** et les **transactions** ACID que nous allons utiliser dans cet atelier. C'est d'ailleurs la base de données la plus déployée au monde : elle est présente dans chaque téléphone Android ou iPhone et dans chaque navigateur web.

> 💡 Pour une formation, SQLite est idéal : aucune installation, et une base de test **en mémoire** (`':memory:'`), qui disparaît à la fin du programme. Le SQL que nous écrivons, lui, est presque identique avec PostgreSQL ou MySQL : changer de base plus tard ne demandera pas de tout réapprendre.
>
> 🔎 **SQLite** est la base de données ; **`better-sqlite3`** est le **pilote**, le paquet npm qui permet à Node.js de l'utiliser.

---

## Étape 1 — Installer le pilote

```bash
npm install better-sqlite3@12
```

> ⚠️ **Version 12** : c'est celle qu'accepte TypeORM 1.x, que nous installerons à l'atelier suivant.
>
> 💡 `better-sqlite3` est un module **natif**, écrit en C++. npm télécharge une version précompilée pour votre système. Si `require('better-sqlite3')` échoue avec npm 11, autorisez son script d'installation : `npm install-scripts approve better-sqlite3`, puis `npm rebuild better-sqlite3`.

Créez `scripts/sql-demo.js` et ajoutez le script npm `"demo:sql": "node scripts/sql-demo.js"`. Construisez le script **section par section**, en le relançant à chaque fois. La correction complète est dans [scripts/sql-demo.js](E05-connecter-sqlite/scripts/sql-demo.js).

## Étape 2 — Se connecter et créer les tables

```js
const Database = require('better-sqlite3');

const db = new Database(':memory:'); // ou new Database('data/demo.db') pour un fichier
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE quiz (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    title     TEXT    NOT NULL UNIQUE,
    published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1))
  );
  CREATE TABLE question (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    statement TEXT    NOT NULL,
    quiz_id   INTEGER NOT NULL REFERENCES quiz(id) ON DELETE CASCADE
  );
`);
```

| Contrainte | Garantie |
|---|---|
| `PRIMARY KEY AUTOINCREMENT` | identifiant unique, attribué par la base (fini notre `maxId` de E02 !) |
| `NOT NULL` | valeur obligatoire |
| `UNIQUE` | pas deux quiz avec le même titre |
| `CHECK (...)` | condition à respecter (SQLite n'a pas de type booléen : 0 ou 1) |
| `REFERENCES quiz(id)` | **clé étrangère** : une question appartient à un quiz qui existe |
| `ON DELETE CASCADE` | supprimer un quiz supprime ses questions |

> 💡 `db.pragma('foreign_keys = ON')` : SQLite n'applique les clés étrangères **que si on le lui demande**, à chaque connexion.
>
> 💡 `better-sqlite3` est **synchrone** : pas de `await`. C'est un choix de ce pilote, adapté à une base locale très rapide. Les pilotes de PostgreSQL ou MySQL (`pg`, `mysql2`), eux, retournent des Promises.

## Étape 3 — Insérer et lire avec des requêtes préparées

```js
const insertQuiz = db.prepare('INSERT INTO quiz (title, published) VALUES (?, ?)');
const insertQuestion = db.prepare('INSERT INTO question (statement, quiz_id) VALUES (?, ?)');

const { lastInsertRowid: nodeId } = insertQuiz.run('Les bases de Node.js', 1);
insertQuestion.run('Quel moteur JavaScript Node.js utilise-t-il ?', nodeId);
insertQuestion.run('Que retourne une fonction async ?', nodeId);
insertQuiz.run('Brouillon secret', 0);

const rows = db.prepare(`
  SELECT quiz.title, COUNT(question.id) AS questions
    FROM quiz LEFT JOIN question ON question.quiz_id = quiz.id
   GROUP BY quiz.id`).all();
console.table(rows);
```

| Méthode | Usage |
|---|---|
| `db.prepare(sql)` | compile la requête une fois ; réutilisable |
| `.run(...params)` | `INSERT`, `UPDATE`, `DELETE` → `{ changes, lastInsertRowid }` |
| `.get(...params)` | la **première** ligne (ou `undefined`) |
| `.all(...params)` | **toutes** les lignes (un tableau) |

Chaque `?` est remplacé par un paramètre, **dans l'ordre**.

## Étape 4 — 🔐 L'injection SQL

Imaginez une recherche par titre où l'utilisateur tape : `x' OR '1'='1`

```js
const saisie = "x' OR '1'='1";

// ❌ Concaténation : la saisie devient du CODE SQL
db.prepare(`SELECT title FROM quiz WHERE title = '${saisie}'`).all();
// → WHERE title = 'x' OR '1'='1'  : toujours vrai → TOUS les quiz, brouillons compris !

// ✅ Paramètre : la saisie reste une VALEUR
db.prepare('SELECT title FROM quiz WHERE title = ?').all(saisie);
// → [] : aucun quiz ne s'appelle « x' OR '1'='1 »
```

> 🔐 **Règle absolue : ne jamais construire une requête SQL en collant des données externes.** Toujours des paramètres. Avec une saisie comme `'; DROP TABLE quiz; --`, l'injection peut détruire ou voler toute la base. C'est l'une des failles les plus exploitées au monde.

## Étape 5 — Les contraintes en action

Essayez d'insérer un titre en double, `published = 5`, puis une question rattachée au quiz 999. Entourez chaque essai d'un `try`/`catch` et affichez `error.message` :

```text
UNIQUE constraint failed: quiz.title
CHECK constraint failed: published IN (0, 1)
FOREIGN KEY constraint failed
```

> 🔎 Les contraintes sont un **dernier filet de sécurité** : même avec un bug dans nos validateurs (E02), la base refuse les données incohérentes.

## Étape 6 — Une transaction

Créer un quiz **et** ses questions, c'est plusieurs `INSERT`. Si le 3ᵉ échoue, il ne faut pas laisser un quiz à moitié créé :

```js
const createQuizWithQuestions = db.transaction((title, statements) => {
  const { lastInsertRowid } = insertQuiz.run(title, 0);
  for (const statement of statements) insertQuestion.run(statement, lastInsertRowid);
});

try {
  createQuizWithQuestions('Quiz incomplet', ['Question valide', null]); // null : NOT NULL refuse
} catch (error) {
  console.log(`Transaction annulée : ${error.message}`);
}
// SELECT COUNT(*) ... WHERE title = 'Quiz incomplet'  → 0
```

> 🔎 **Transaction = tout ou rien.** Si la fonction lève une erreur, **toutes** ses écritures sont annulées (`ROLLBACK`) ; sinon, elles sont validées ensemble (`COMMIT`). C'est le « A » (*atomicité*) des propriétés **ACID** des bases relationnelles.

Terminez par un `DELETE` du premier quiz et vérifiez que ses questions ont disparu (`ON DELETE CASCADE`), puis `db.close()`.

## Vérifications

```bash
npm run demo:sql
```

```text
1. Tables créées
2. Quiz n°1 inséré avec 2 questions
3. Jointure : (tableau)
4. Concaténation : [ 'Brouillon secret', 'Les bases de Node.js' ]
   Paramètre     : []
5. Refusé — titre en double (UNIQUE) : UNIQUE constraint failed: quiz.title
5. Refusé — published = 5 (CHECK) : CHECK constraint failed: published IN (0, 1)
5. Refusé — quiz 999 inexistant (FOREIGN KEY) : FOREIGN KEY constraint failed
6. Transaction annulée : NOT NULL constraint failed: question.statement
   Quiz « Quiz incomplet » en base : 0 (rien n'a été enregistré)
7. Quiz supprimé : il reste 0 question (ses questions ont suivi)
```

L'API, elle, n'a pas changé : elle utilise toujours les fichiers JSON. Le [scénario](E05-connecter-sqlite/scripts/scenario.js) et le fichier [requests.http](E05-connecter-sqlite/requests.http) de E04 donnent les mêmes résultats.

## SQL ou NoSQL ?

Le chapitre 13 présente aussi les bases **NoSQL**, comme MongoDB, qui stockent des **documents** JSON. Nos quiz, avec leurs questions imbriquées, ressemblent d'ailleurs à des documents ! Nous choisissons une base relationnelle pour ses **contraintes**, ses **jointures** et ses **transactions**, et parce que les données d'EduTrack sont fortement liées : quiz → questions → réponses.

## Récapitulatif

- Un **pilote** (`better-sqlite3`) relie Node.js à la base.
- **Requêtes préparées + paramètres `?`** : performances et protection contre l'**injection SQL**.
- Les **contraintes** garantissent la cohérence des données, même en cas de bug.
- Une **transaction** regroupe plusieurs écritures en « tout ou rien ».

## Pour aller plus loin

- Ajoutez une table `answer` (`label`, `is_correct`, `question_id`) et une contrainte qui interdit deux réponses de même libellé dans une même question : `UNIQUE (question_id, label)`.
- Ouvrez une base fichier (`data/demo.db`) avec l'extension VS Code **SQLite Viewer**.
- Écrivez une requête qui liste, pour chaque quiz, le nombre de questions et de réponses (deux jointures).
