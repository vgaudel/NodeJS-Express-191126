// Middlewares de contrôle des requêtes (E02).
//
// Un middleware est une fonction (req, res, next) :
//  - soit il RÉPOND (et la chaîne s'arrête) ;
//  - soit il appelle next() pour passer au middleware suivant ;
//  - soit il lève une erreur (ou appelle next(erreur)) : Express saute alors
//    directement au gestionnaire d'erreurs.
const { AppError, ValidationError } = require('../utils/errors');

// 415 si le corps n'est pas du JSON.
// (express.json ignore les autres types : req.body resterait undefined.)
function requireJson(req, res, next) {
  if (!req.is('application/json')) {
    throw new AppError('Le corps doit être au format JSON (Content-Type: application/json)', 415);
  }
  next();
}

// « Fabrique » de middleware : validate(validateQuiz) RETOURNE un middleware
// qui applique ce validateur à req.body.
function validate(validator) {
  return (req, res, next) => {
    const errors = validator(req.body);
    if (errors.length > 0) throw new ValidationError('Données invalides', errors);
    next();
  };
}

// 405 : la route existe, mais pas pour cette méthode.
function methodNotAllowed(allowed) {
  return (req, res) => {
    res.set('Allow', allowed.join(', '));
    res.status(405).json({ error: `Méthode ${req.method} non autorisée` });
  };
} 

module.exports = { requireJson, validate, methodNotAllowed };
