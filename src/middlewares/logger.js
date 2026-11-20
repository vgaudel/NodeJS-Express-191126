// Journal des requêtes (E02) : notre premier middleware « fait main ».
//
// Un middleware est une fonction (req, res, next). Celui-ci ne répond pas :
// il note l'heure de départ, puis passe la main avec next().
function logger(req, res, next) {
  const start = performance.now();
  // Le statut n'est connu qu'à la FIN : on s'abonne à l'événement « finish »
  // de la réponse (res est un EventEmitter, comme la QuizSession de A03).
  res.on('finish', () => {
    const ms = Math.round(performance.now() - start);
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms} ms`);
  });
  next(); // !! sans next(), la requête resterait bloquée ici !!
}

module.exports = { logger };