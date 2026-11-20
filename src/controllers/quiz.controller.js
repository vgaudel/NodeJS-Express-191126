const quizService = require('../services/quiz.service')

async function list(req, res) {
  res.json(await quizService.listQuizzes(req.user)); // statut 200 par défaut
}

async function getOne(req, res) {
  res.json(await quizService.getQuiz(req.quizId));
}

async function create(req, res) {
  const quiz = await quizService.createQuiz(req.body);
  // 201 Created + en-tête Location : l'adresse de la ressource créée
  res.status(201).location(`/api/quizzes/${quiz.id}`).json(quiz);
}

async function update(req, res) {
  res.json(await quizService.updateQuiz(req.quizId, req.body));
}

async function remove(req, res) {
  await quizService.deleteQuiz(req.quizId);
  res.status(204).end(); // 204 No Content : succès, sans corps de réponse
}

async function submit(req, res) {
  res.json(await quizService.submitAnswers(req.quizId, req.body.answers));
}

module.exports = { list, getOne, create, update, remove, submit };