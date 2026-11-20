// Configuration de l'application (E03 ; JWT en E04 ; base de données en E06).
//
// Les valeurs viennent des VARIABLES D'ENVIRONNEMENT. En développement, elles
// sont lues dans le fichier .env grâce à l'option de Node.js :
//   node --env-file-if-exists=.env src/index.js      (voir package.json)
// En production, on les définit directement sur le serveur.
// Le reste du code fait require('./config') au lieu de lire process.env.
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..'); // dossier racine du projet

module.exports = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT) || 3000,
  // « http://a.fr,http://b.fr » → ['http://a.fr', 'http://b.fr'] ; vide → []
  corsOrigins: (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  // E04 : secret de signature des jetons JWT. AUCUNE valeur par défaut :
  // un secret « par défaut » serait connu de tous (il est dans le code !).
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '2h',
  // E06 : fichier de la base SQLite (':memory:' pour une base en mémoire)
  dbPath: process.env.DB_PATH ?? path.join(ROOT, 'data', 'edutrack.db'),
};
