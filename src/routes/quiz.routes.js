const { Router } = require('express');
const controller = require('../controllers/quiz.controller');

const router = Router();

router.get('/', controller.list);
router.get('/:id',controller.getOne); // :id = paramètre de route req.params.id

module.exports = router;