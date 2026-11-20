// Correction complète de la démo SQLite et de l'exercice « Pour aller plus loin ».
// Lancement : node scripts/sql-demo-correction.js
'use strict';

const Database = require('better-sqlite3');

const db = new Database('./data/test2.db');
db.pragma('foreign_keys = ON');

// 1. Créer les tables
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
  CREATE TABLE answer (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    label       TEXT    NOT NULL,
    is_correct  INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
    question_id INTEGER NOT NULL REFERENCES question(id) ON DELETE CASCADE,
    UNIQUE (question_id, label)
  );
`);
console.log('1. Tables créées');

// 2. Insérer un quiz, ses questions et leurs réponses
const insertQuiz = db.prepare('INSERT INTO quiz (title, published) VALUES (?, ?)');
const insertQuestion = db.prepare('INSERT INTO question (statement, quiz_id) VALUES (?, ?)');
const insertAnswer = db.prepare(
  'INSERT INTO answer (label, is_correct, question_id) VALUES (?, ?, ?)',
);

const { lastInsertRowid: quizId } = insertQuiz.run('Les bases de Node.js', 1);
const { lastInsertRowid: engineQuestionId } = insertQuestion.run(
  'Quel moteur JavaScript Node.js utilise-t-il ?',
  quizId,
);
const { lastInsertRowid: asyncQuestionId } = insertQuestion.run(
  'Que retourne une fonction async ?',
  quizId,
);

insertAnswer.run('V8', 1, engineQuestionId);
insertAnswer.run('SpiderMonkey', 0, engineQuestionId);
insertAnswer.run('Une Promise', 1, asyncQuestionId);
insertAnswer.run('Une chaîne de caractères', 0, asyncQuestionId);
insertQuiz.run('Brouillon secret', 0);
console.log(`2. Quiz n°${quizId} inséré avec 2 questions et 4 réponses`);

// 3. Deux jointures : compter questions et réponses pour chaque quiz
const quizCounts = db
  .prepare(
    `SELECT quiz.title,
            COUNT(DISTINCT question.id) AS questions,
            COUNT(DISTINCT answer.id) AS answers
       FROM quiz
       LEFT JOIN question ON question.quiz_id = quiz.id
       LEFT JOIN answer ON answer.question_id = question.id
      GROUP BY quiz.id`,
  )
  .all();
console.log('3. Questions et réponses par quiz :');
console.table(quizCounts);

// 4. Une saisie utilisateur malveillante ne doit pas être collée au SQL
const saisie = "x' OR '1'='1";
const injecte = db.prepare(`SELECT title FROM quiz WHERE title = '${saisie}'`).all();
console.log('4. Concaténation :', injecte.map((row) => row.title));

const protege = db.prepare('SELECT title FROM quiz WHERE title = ?').all(saisie);
console.log('   Paramètre     :', protege.map((row) => row.title));

// 5. Vérifier les contraintes
for (const [label, action] of [
  ['titre en double (UNIQUE)', () => insertQuiz.run('Les bases de Node.js', 1)],
  ['published = 5 (CHECK)', () => insertQuiz.run('Autre quiz', 5)],
  ['quiz 999 inexistant (FOREIGN KEY)', () => insertQuestion.run('Orpheline ?', 999)],
  [
    'réponse en double pour une question (UNIQUE)',
    () => insertAnswer.run('V8', 0, engineQuestionId),
  ],
]) {
  try {
    action();
  } catch (error) {
    console.log(`5. Refusé — ${label} : ${error.message}`);
  }
}

// 6. Une transaction annule toutes les écritures si l'une d'elles échoue
const createQuizWithQuestions = db.transaction((title, statements) => {
  const { lastInsertRowid } = insertQuiz.run(title, 0);
  for (const statement of statements) insertQuestion.run(statement, lastInsertRowid);
});

try {
  createQuizWithQuestions('Quiz incomplet', ['Question valide', null]);
} catch (error) {
  console.log(`6. Transaction annulée : ${error.message}`);
}
const incompleteQuiz = db
  .prepare('SELECT COUNT(*) AS n FROM quiz WHERE title = ?')
  .get('Quiz incomplet');
console.log(`   Quiz « Quiz incomplet » en base : ${incompleteQuiz.n}`);

// 7. ON DELETE CASCADE supprime aussi les questions et réponses liées
db.prepare('DELETE FROM quiz WHERE id = ?').run(quizId);
const remaining = db
  .prepare(`
    SELECT
      (SELECT COUNT(*) FROM question) AS questions,
      (SELECT COUNT(*) FROM answer) AS answers
  `)
  .get();
console.log(
  `7. Quiz supprimé : ${remaining.questions} question et ${remaining.answers} réponse restante`,
);

db.close();
