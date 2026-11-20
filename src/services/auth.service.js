// Authentification par jeton JWT (E04).
//
// Un JWT (JSON Web Token) est une chaîne en trois parties « en-tête.contenu.signature ».
// Le contenu est LISIBLE par tous (simple encodage base64) : on n'y met jamais
// de secret. La SIGNATURE, calculée avec JWT_SECRET, garantit que le contenu
// n'a pas été modifié : sans le secret, impossible de fabriquer un jeton valide.
const jwt = require('jsonwebtoken');
const config = require('../config');
const userRepository = require('../repositories/user.repository');
const { verifyPassword } = require('./password.service');
const { UnauthorizedError } = require('../utils/errors');

// Ce que l'on peut montrer d'un utilisateur (jamais passwordHash !)
function toPublicUser(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

async function login(email, password) {
  const user = await userRepository.findByEmail(email);
  // 🔐 Même message que l'e-mail soit inconnu ou le mot de passe faux :
  // on ne révèle pas quels comptes existent.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new UnauthorizedError('E-mail ou mot de passe incorrect');
  }

  const token = jwt.sign(
    { sub: user.id, role: user.role, name: user.name }, // « sub » (subject) : l'identifiant
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn, algorithm: 'HS256' },
  );
  return { token, user: toPublicUser(user) };
}

// Vérifie la signature et la date d'expiration ; renvoie l'utilisateur du jeton.
function verifyToken(token) {
  try {
    // algorithms : on n'accepte QUE l'algorithme attendu
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    return { id: payload.sub, role: payload.role, name: payload.name };
  } catch {
    throw new UnauthorizedError('Jeton invalide ou expiré');
  }
}

async function getProfile(userId) {
  const user = await userRepository.findById(userId);
  if (!user) throw new UnauthorizedError('Utilisateur introuvable');
  return toPublicUser(user);
}

module.exports = { login, verifyToken, getProfile };
