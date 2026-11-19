// Règles métier des quiz (E01).
//
// Le service se place entre le contrôleur (HTTP) et le repository (stockage).
// Il RÉUTILISE le code de l'atelier A06, sans le modifier :
//  - quiz.repository.js pour lire les quiz (fs/promises) ;
//  - score.service.js pour calculer le score (fonction pure).
// C'est ici, et seulement ici, que l'on applique les règles des spécifications :
//  - seuls les quiz PUBLIÉS sont visibles ;
//  - les bonnes réponses ne sont jamais envoyées avant la soumission ;
//  - le score est calculé par le serveur.
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

// Retrouve un quiz PUBLIÉ : un brouillon est « introuvable » pour le public.
async function findPublished(id) {
  const quiz = await quizRepository.findById(id);
  if (!quiz || !quiz.published) throw new NotFoundError(`Quiz ${id} introuvable`);
  return quiz;
}

// --- Fonctions publiques -----------------------------------------------------

async function listQuizzes() {
  const quizzes = await quizRepository.findAll();
  return quizzes.filter((q) => q.published).map(toSummary);
}

async function getQuiz(id) {
  return toPublicQuiz(await findPublished(id));
}

// answers : [{ questionId, answerId }]
async function submitAnswers(id, answers) {
  // Contrôle minimal : il sera remplacé par un vrai validateur en E02.
  if (!Array.isArray(answers)) throw new ValidationError('answers doit être un tableau');

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

module.exports = { listQuizzes, getQuiz, submitAnswers };
