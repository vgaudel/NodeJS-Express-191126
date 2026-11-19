// Erreurs métier de l'application (E01).
//
// Chaque erreur porte le code de statut HTTP à renvoyer (« status »).
// Le service lève simplement « NotFoundError » ou « ValidationError » sans
// rien connaître d'Express : c'est le gestionnaire d'erreurs qui lira
// error.status pour construire la réponse.
class AppError extends Error {
  constructor(message, status = 500, details = undefined) {
    super(message); // initialise message et pile d'appels (stack)
    this.name = this.constructor.name; // ex. : 'NotFoundError'
    this.status = status;
    this.details = details;
  }
}

class ValidationError extends AppError {
  constructor(message, details) {
    super(message, 400, details);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Ressource introuvable') {
    super(message, 404);
  }
}

module.exports = { AppError, ValidationError, NotFoundError };
