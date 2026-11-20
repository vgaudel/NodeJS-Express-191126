// Routes des quiz (E01, validation en E02).
// Ce routeur est monté sur /api/quizzes dans app.js.
//
// Pour chaque route, les fonctions s'exécutent DANS L'ORDRE, par exemple :
//   requireJson → validate(validateQuiz) → controller.create
// Si l'une d'elles lève une erreur, les suivantes ne sont pas appelées.
const { Router } = require('express');
const controller = require('../controllers/quiz.controller');
const { requireJson, validate, methodNotAllowed } = require('../middlewares/validate');
const { validateQuiz, validateQuizUpdate, validateSubmission } = require('../validators/quiz.validator');
const { ValidationError } = require('../utils/errors');

const router = Router();

// router.param : exécuté pour TOUTE route de ce routeur contenant :id.
router.param('id', (req, res, next, value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new ValidationError(`Identifiant invalide : ${value}`);
  req.quizId = id; // les contrôleurs utiliseront req.quizId (un nombre)
  next();
});

// router.route : plusieurs méthodes pour un même chemin, et .all() pour les autres (405).
router
  .route('/')
  .get(controller.list)
  .post(requireJson, validate(validateQuiz), controller.create)
  .all(methodNotAllowed(['GET', 'POST']));

router
  .route('/:id')
  .get(controller.getOne)
  .patch(requireJson, validate(validateQuizUpdate), controller.update)
  .delete(controller.remove)
  .post(requireJson, validate(validateSubmission), controller.submit)
  .all(methodNotAllowed(['GET', 'PATCH', 'DELETE', 'POST']));


module.exports = router;
