// Application Express (E01).
//
// Chaque app.use(...) ajoute un MIDDLEWARE. Pour chaque requête, Express
// parcourt cette chaîne DANS L'ORDRE, jusqu'à ce que l'un d'eux réponde :
//   lecture du JSON → routes → 404 → erreurs
//
// C'est une API REST : elle ne renvoie QUE du JSON, jamais de page HTML.
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const quizRoutes = require('./routes/quiz.routes');
const authRoutes = require('./routes/auth.routes');
const { logger } = require('./middlewares/logger');
const { notFound , errorHandler} = require('./middlewares/error-handler')
const app = express();


// Helmet : ajoute des en-têtes de sécurité (Content-Security-Policy,
// X-Content-Type-Options, etc.) et retire X-Powered-By: Express.
app.use(helmet());
// CORS : autorise UNIQUEMENT les origines listées dans CORS_ORIGIN à appeler
// l'API depuis un navigateur. Liste vide → aucune origine extérieure.
app.use(cors({ origin: config.corsOrigins }));
// Morgan : journal des requêtes. Il remplace notre logger de E02.
// morgan(format) RETOURNE un middleware (c'est une fabrique, comme validate en E02).
// Ce middleware appelle next() tout de suite, puis écrit UNE ligne dans la
// console quand la réponse est partie (statut et durée ne sont connus qu'à ce moment).
//
// Le format dépend de l'environnement (NODE_ENV, lu dans src/config) :
//  - 'dev' (développement) : ligne courte et colorée, faite pour être lue à l'écran
//      GET /api/quizzes 200 4.364 ms - 2646
//      (méthode, URL, statut, durée, taille de la réponse en octets)
//  - 'combined' (production) : format standard des serveurs web (Apache), avec
//    l'adresse IP du client, la date, le navigateur (User-Agent)… Il est compris
//    par les outils qui analysent les journaux.
//      ::1 - - [20/Nov/2026:08:15:02 +0000] "GET /api/quizzes HTTP/1.1" 200 2646 "-" "curl/8.9.1"
//  - 'test' : AUCUN journal. Pendant les tests automatisés (E08), des centaines
//    de lignes noieraient les résultats : on ne branche donc pas Morgan du tout.
if (config.env !== 'test') {
  app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
}

// 0. On intercepte toutes les requètes pour les passer dans notre middleware logger
// Notre logger maison a été remplacé par Morgan
// app.use(logger);

// 1. Lire le body JSON et le place dans le req.body (400 si JSON invalide, 413 si trop gros)
app.use(express.json({limit: '100kb'}));

// 2. Accueil de l'API : un simple document json qui indique les points d'entrée.
app.get('/', (req, res) => {
    res.json({ name : 'Edutrack API', endpoints: { quizzes: '/api/quizzes'}});
});

// 3. Les routes de l'API, en précisant le préfixe /api/feature
app.use('/api/auth', authRoutes); 
app.use('/api/quizzes', quizRoutes);  

// 4. Personne n'a répondu : 404
app.use(notFound);

// 5. Gestionnaire d'erreurs : Express le reconnaît à ses QUATRE paramètres.
// eslint-disable-next-line no-unused-vars
app.use(errorHandler);
module.exports = app;