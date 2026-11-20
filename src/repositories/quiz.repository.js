// Accès aux quiz stockés dans data/quizzes.json — version PROMISES (A06).
//
// Comparez avec la version callbacks de A04 : mêmes étapes, mais
//  - on utilise fs/promises, dont les fonctions RETOURNENT une Promise ;
//  - chaque fonction est « async » : elle retourne elle aussi une Promise ;
//  - les erreurs se propagent toutes seules (throw / rejet) : plus besoin de
//    « if (error) return callback(error) » à chaque étape.
const fs = require('node:fs/promises');
const path = require('node:path');

const FILE = path.join(__dirname, '..', '..', 'data', 'quizzes.json');

async function readAll() {
  // await suspend la fonction jusqu'à la fin de la lecture (sans bloquer Node.js).
  // Si la lecture échoue, l'erreur est levée ici et remonte à l'appelant.
  const content = await fs.readFile(FILE, 'utf8');
  try {
    return JSON.parse(content);
  } catch (parseError) {
    throw new Error(`data/quizzes.json est invalide : ${parseError.message}`);
  }
}

async function writeAll(quizzes) {
  // Écriture atomique : fichier temporaire, puis renommage.
  const tmp = `${FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(quizzes, null, 2) + '\n', 'utf8');
  await fs.rename(tmp, FILE);
}

async function findAll() {
  return readAll();
}

async function findById(id) {
  const quizzes = await readAll();
  return quizzes.find((q) => q.id === id) ?? null;
}

// Ajoute le quiz, ou le remplace s'il existe déjà (même id).
async function save(quiz) {
  const quizzes = await readAll();
  const index = quizzes.findIndex((q) => q.id === quiz.id);
  if (index === -1) quizzes.push(quiz);
  else quizzes[index] = quiz;
  await writeAll(quizzes);
  return quiz;
}

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
  await writeAll(quizzes); // l'écriture atomique écrite en E01
  return quiz;
}

// Supprime un quiz. Renvoie true s'il existait, false sinon.
async function remove(id) {
  const quizzes = await readAll();
  const remaining = quizzes.filter((q) => q.id !== id);
  if (remaining.length === quizzes.length) return false;
  await writeAll(remaining);
  return true;
}

module.exports = { findAll, findById, save, create, maxId, remove };
