// Middlewares d'authentification et d'autorisation (E04).
//
// Le client envoie son jeton dans l'en-tête :
//   Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
const { verifyToken } = require('../services/auth.service');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');

// Renvoie le jeton de l'en-tête Authorization, ou null s'il n'y en a pas.
function readToken(req) {
  const header = req.get('Authorization') ?? '';
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

// AUTHENTIFICATION obligatoire : 401 sans jeton valide.
// Ensuite, req.user = { id, role, name } est disponible pour la suite.
function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) throw new UnauthorizedError();
  req.user = verifyToken(token);
  next();
}

// Authentification FACULTATIVE : un visiteur anonyme passe (req.user reste
// undefined), mais un jeton présent doit être valide.
function optionalAuth(req, res, next) {
  const token = readToken(req);
  if (token) req.user = verifyToken(token);
  next();
}

// AUTORISATION : 403 si l'utilisateur connecté n'a pas l'un des rôles demandés.
// À placer APRÈS requireAuth.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError(`Action réservée au rôle : ${roles.join(', ')}`);
    }
    next();
  };
}

module.exports = { requireAuth, optionalAuth, requireRole };
