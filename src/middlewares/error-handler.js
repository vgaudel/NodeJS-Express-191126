// Fin de chaîne : route introuvable et gestionnaire d'erreurs (E02).
// Code déplacé depuis app.js (E01), puis complété.
const { AppError } = require('../utils/errors');

// Aucune route n'a répondu : 404.
function notFound(req, res) {
  res.status(404).json({ error: `Route introuvable : ${req.method} ${req.path}` });
}

// Gestionnaire d'erreurs : Express le reconnaît à ses QUATRE paramètres.
// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, next) {
  // 1. Nos erreurs métier : statut et message prévus
  if (error instanceof AppError) {
    return res.status(error.status).json({ error: error.message, details: error.details });
  }
  // 2. Erreurs de express.json, reconnaissables à leur « type » :
  //    on remplace le message technique (en anglais) par un message clair
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON invalide' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Corps de requête trop volumineux' });
  }
  // 3. Erreur imprévue : on la journalise, sans rien révéler au client
  console.error(error);
  res.status(500).json({ error: 'Erreur interne du serveur' });
}

module.exports = { notFound, errorHandler };
