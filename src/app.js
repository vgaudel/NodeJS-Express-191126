// Application Express (E01).
//
// Chaque app.use(...) ajoute un MIDDLEWARE. Pour chaque requête, Express
// parcourt cette chaîne DANS L'ORDRE, jusqu'à ce que l'un d'eux réponde :
//   lecture du JSON → routes → 404 → erreurs
//
// C'est une API REST : elle ne renvoie QUE du JSON, jamais de page HTML.
const express = require('express');
const quizRoutes = require('./routes/quiz.routes');

const app = express();

// 1. Lire le body JSON et le place dans le req.body (400 si JSON invalide, 413 si trop gros)
app.use(express.json({limit: '100kb'}));

// 2. Accueil de l'API : un simple document json qui indique les points d'entrée.
app.get('/', (req, res) => {
    res.json({ name : 'Edutrack API', endpoints: { quizzes: '/api/quizzes'}});
});

// 3. Les routes de l'API, en précisant le préfixe /api/feature
app.use('/api/quizzes', quizRoutes);


module.exports = app;