// Découverte de SQL avec SQLite et le pilote better-sqlite3 (E05).
// Lancement :  npm run demo:sql
//
// La base est créée EN MÉMOIRE (':memory:') : elle disparaît à la fin du
// script. Pour un fichier : new Database('data/demo.db').
//
// better-sqlite3 est SYNCHRONE : pas de Promise ni de callback. C'est un choix
// de ce pilote (SQLite est une base locale, très rapide). Les pilotes de bases
// distantes (PostgreSQL, MySQL) sont, eux, asynchrones.
'use strict';

const Database = require('better-sqlite3');

const db = new Database('./data/test.db');
db.pragma('foreign_keys = ON'); // SQLite n'applique les clés étrangères que si on le demande

// --- 1. Créer les tables (le « schéma ») ---------------------------------------
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
console.log('1. Tables créées');

// --- 2. Insérer avec une requête PRÉPARÉE et des paramètres ? ------------------
const insertQuiz = db.prepare('INSERT INTO quiz (title, published) VALUES (?, ?)');
const insertQuestion = db.prepare('INSERT INTO question (statement, quiz_id) VALUES (?, ?)');

const { lastInsertRowid: nodeId } = insertQuiz.run('Les bases de nodeJS', 1);
insertQuestion.run('Quel moteur JavaScript Node.js utilise-t-il ?', nodeId);
insertQuestion.run('Que retourne une fonction async ?', nodeId);
insertQuiz.run('Brouillon secret', 0);
console.log(`2. Quiz n°${nodeId} inséré avec 2 questions`);


// --- 3. Lire : get() = une ligne, all() = toutes les lignes ---------------------
const rows = db
  .prepare(
    `SELECT quiz.title, COUNT(question.id) AS questions
       FROM quiz LEFT JOIN question ON question.quiz_id = quiz.id
      GROUP BY quiz.id`,
  )
  .all();
console.log('3. Jointure :');
console.table(rows);
// --- 4. L'injection SQL ------------------------------------------------------------
const saisie = "x' OR '1'='1"; // ce qu'un utilisateur malveillant tape dans un champ « titre »

// ❌ DANGER : la saisie est COLLÉE dans le texte SQL et devient du code SQL.
//
// Le développeur pense écrire :  WHERE title = '<le titre saisi>'
// et attend que tout ce que tape l'utilisateur reste ENTRE les deux apostrophes.
// Mais la saisie contient elle-même des apostrophes. Une fois collée, la requête
// envoyée à SQLite devient :
//
//   SELECT title FROM quiz WHERE title = 'x' OR '1'='1'
//
// Lisons-la comme SQLite, morceau par morceau :
//   title = '      → apostrophe écrite par le développeur : début de la chaîne
//   x'             → début de la saisie : son apostrophe FERME la chaîne trop tôt
//   OR '1'='1      → la suite de la saisie n'est plus une donnée : c'est du CODE SQL
//   '              → apostrophe finale du développeur : elle complète '1 en '1',
//                    si bien que la requête reste syntaxiquement valide
//
// SQLite ne peut pas savoir où s'arrêtait la donnée : il voit deux conditions,
// title = 'x' (fausse) OR '1' = '1' (toujours vraie). « Faux OU vrai » vaut
// vrai : le WHERE laisse passer TOUTES les lignes, brouillons compris.
const injecte = db.prepare(`SELECT title FROM quiz WHERE title = '${saisie}'`).all();
console.log('4. Concaténation :', injecte.map((r) => r.title)); 

// ✅ Paramètre : la saisie reste une simple VALEUR, jamais interprétée comme du SQL.
const protege = db.prepare('SELECT title FROM quiz WHERE title = ?').all(saisie);
console.log('   Paramètre     :', protege.map((r) => r.title)); // [] : aucun quiz ne s'appelle ainsi

// --- 5. Les contraintes protègent les données -----------------------------------------
for (const [label, action] of [
  ['titre en double (UNIQUE)', () => insertQuiz.run('Les bases de nodeJS', 1)],
  ['published = 5 (CHECK)', () => insertQuiz.run('Autre quiz', 5)],
  ['quiz 999 inexistant (FOREIGN KEY)', () => insertQuestion.run('Orpheline ?', 999)],
]) {
  try {
    action();
  } catch (error) {
    console.log(`5. Refusé — ${label} : ${error.message}`);
  }
}


// --- 6. Une TRANSACTION : tout ou rien ------------------------------------------------
// db.transaction(fn) renvoie une fonction : si fn lève une erreur, TOUTES ses
// écritures sont annulées (ROLLBACK) ; sinon, elles sont validées (COMMIT).
const createQuizWithQuestions = db.transaction((title, statements) => {
  const { lastInsertRowid } = insertQuiz.run(title, 0);
  for (const statement of statements) insertQuestion.run(statement, lastInsertRowid);
});

try {
  // La 2e question est null : NOT NULL la refuse… APRÈS l'insertion du quiz et de la 1re question
  createQuizWithQuestions('Quiz incomplet', ['Question valide', null]);
} catch (error) {
  console.log(`6. Transaction annulée : ${error.message}`);
}
const rows2 = db
  .prepare(
    `SELECT quiz.title, COUNT(question.id) AS questions
       FROM quiz LEFT JOIN question ON question.quiz_id = quiz.id
      GROUP BY quiz.id`,
  )
  .all();
console.table(rows2);


// --- 7. ON DELETE CASCADE ---------------------------------------------------------------
db.prepare('DELETE FROM quiz WHERE id = ?').run(nodeId);
const left = db.prepare('SELECT COUNT(*) AS n FROM question').get();
console.log(`7. Quiz supprimé : il reste ${left.n} question (ses questions ont suivi)`);
