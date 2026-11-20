// Règles métier des quiz (E01 ; création, modification et suppression en E02 ;
// vue formateur en E04).
//
// Le service se place entre le contrôleur (HTTP) et le repository (stockage).
// Il RÉUTILISE le code de l'atelier A06 :
//  - quiz.repository.js pour lire et écrire les quiz (fs/promises) ;
//  - score.service.js pour calculer le score (fonction pure).
// C'est ici, et seulement ici, que l'on applique les règles des spécifications :
//  - seuls les quiz PUBLIÉS sont visibles ;
//  - les bonnes réponses ne sont jamais envoyées avant la soumission ;
//  - le score est calculé par le serveur.
//
// E02 : le FORMAT des données est vérifié en amont par les validateurs
// (middleware validate) ; le service vérifie ce qui dépend des données
// stockées (le quiz existe-t-il ? la question lui appartient-elle ?).
const quizRepository = require('../repositories/quiz.repository');
const { computeScore } = require('./score.service');
const { NotFoundError, ValidationError } = require('../utils/errors');

// --- Mise en forme (fonctions non exportées) -------------------------------

// Résumé d'un quiz, pour une liste.
function toSummary(quiz) {
  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    questionCount: quiz.questions.length,
  };
}

// Quiz tel qu'un apprenant peut le voir : SANS le champ isCorrect.
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

// Retrouve un quiz (publié ou non), ou lève une NotFoundError.
async function findOrFail(id) {
  const quiz = await quizRepository.findById(id);
  if (!quiz) throw new NotFoundError(`Quiz ${id} introuvable`);
  return quiz;
}

// Retrouve un quiz PUBLIÉ : un brouillon est « introuvable » pour le public.
async function findPublished(id) {
  const quiz = await findOrFail(id);
  if (!quiz.published) throw new NotFoundError(`Quiz ${id} introuvable`);
  return quiz;
}

// --- Fonctions publiques -----------------------------------------------------

// E04 : un formateur voit TOUS les quiz (brouillons compris), avec les bonnes réponses.
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

// answers : [{ questionId, answerId }] (format déjà validé)
async function submitAnswers(id, answers) {
  const quiz = await findPublished(id);
  // Une réponse doit concerner une question de CE quiz.
  for (const a of answers) {
    if (!quiz.questions.some((q) => q.id === a.questionId)) {
      throw new ValidationError(`La question ${a.questionId} n'appartient pas à ce quiz`);
    }
  }
  // computeScore vient tel quel de A06
  return { quizId: quiz.id, ...computeScore(quiz, answers) };
}

async function createQuiz(data) {
  // On recopie UNIQUEMENT les champs attendus : un champ inconnu envoyé par
  // le client (ex. « id » ou « createdAt ») est ignoré.
  return quizRepository.create({
    title: data.title.trim(),
    description: data.description ?? '',
    published: data.published === true,
    createdAt: new Date().toISOString(),
    questions: data.questions.map((q) => ({
      statement: q.statement,
      answers: q.answers.map((a) => ({ label: a.label, isCorrect: a.isCorrect })),
    })),
  });
}

// changes : { title?, description?, published? } (format déjà validé)
async function updateQuiz(id, changes) {
  const quiz = await findOrFail(id);
  if (changes.title !== undefined) quiz.title = changes.title.trim();
  if (changes.description !== undefined) quiz.description = changes.description;
  if (changes.published !== undefined) quiz.published = changes.published;
  return quizRepository.save(quiz); // save() vient tel quel de A06
}

async function deleteQuiz(id) {
  const deleted = await quizRepository.remove(id);
  if (!deleted) throw new NotFoundError(`Quiz ${id} introuvable`);
}

module.exports = { listQuizzes, getQuiz, submitAnswers, createQuiz, updateQuiz, deleteQuiz };
