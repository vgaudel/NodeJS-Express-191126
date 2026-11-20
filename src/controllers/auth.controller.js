// Contrôleur de l'authentification (E04).
const authService = require('../services/auth.service');

async function login(req, res) {
  res.json(await authService.login(req.body.email, req.body.password));
}

// req.user a été rempli par le middleware requireAuth
async function me(req, res) {
  res.json(await authService.getProfile(req.user.id));
}

module.exports = { login, me };
