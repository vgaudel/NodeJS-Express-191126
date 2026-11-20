// Routes des quiz (E01, validation en E02, droits en E04).
// Ce routeur est monté sur /api/quizzes dans app.js.
//
// Pour chaque route, les fonctions s'exécutent DANS L'ORDRE, par exemple :
//   requireAuth → requireRole → requireJson → validate(validateQuiz) → controller.create
// Si l'une d'elles lève une erreur, les suivantes ne sont pas appelées.
const { Router } = require('express');
const controller = require('../controllers/quiz.controller');
const { requireJson, validate, methodNotAllowed } = require('../middlewares/validate');
const { validateQuiz, validateQuizUpdate, validateSubmission } = require('../validators/quiz.validator');
const { requireAuth, optionalAuth, requireRole } = require('../middlewares/auth');
const { ValidationError } = require('../utils/errors');

const router = Router();

// E04 : les actions de modification sont réservées aux formateurs.
// On vérifie les droits EN PREMIER : inutile de valider un corps envoyé
// par quelqu'un qui n'a pas le droit d'agir.
const trainerOnly = [requireAuth, requireRole('trainer')];

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
  .get(optionalAuth, controller.list) // public ; un formateur voit aussi les brouillons
  .post(trainerOnly, requireJson, validate(validateQuiz), controller.create)
  .all(methodNotAllowed(['GET', 'POST']));

router
  .route('/:id')
  .get(optionalAuth, controller.getOne)
  .patch(trainerOnly, requireJson, validate(validateQuizUpdate), controller.update)
  .delete(trainerOnly, controller.remove)
  .all(methodNotAllowed(['GET', 'PATCH', 'DELETE']));

// Passer un quiz reste public : aucun compte n'est nécessaire.
router
  .route('/:id/submit')
  .post(requireJson, validate(validateSubmission), controller.submit)
  .all(methodNotAllowed(['POST']));

module.exports = router;
