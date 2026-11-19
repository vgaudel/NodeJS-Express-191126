const quizService = require('../services/quiz.service')

async function list(req, res) {
    res.json(await quizService.listQuizzes()); // statu 200 par défaut
}

async function getOne(req, res) {
    // req.params.id est TOUJOURS une chaine : '7' -> 7
    res.json(await quizService.getQuiz(Number(req.params.id)))
}

module.exports = { list, getOne };