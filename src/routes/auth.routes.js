// Routes de l'authentification (E04), montées sur /api/auth.
const { Router } = require('express');
const controller = require('../controllers/auth.controller');
const { requireJson, validate } = require('../middlewares/validate');
const { requireAuth } = require('../middlewares/auth');
const { validateLogin } = require('../validators/auth.validator');

const router = Router();

router.post('/login', requireJson, validate(validateLogin), controller.login);
router.get('/me', requireAuth, controller.me);

module.exports = router;
