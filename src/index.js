// Point d'entrée : met l'application à l'écoute (E01 ; configuration en E03 ;
// contrôle du secret JWT en E04 ; connexion à la base en E06).
// Lancement :  npm start      ou      npm run dev  (redémarrage automatique)
'use strict';

const config = require('./config');
const app = require('./app');
const { AppDataSource } = require('./config/database');

async function main() {
  // E04 : sans secret JWT, l'authentification est impossible : on refuse de
  // démarrer plutôt que de fonctionner dans un état non sécurisé.
  if (!config.jwtSecret) {
    throw new Error('JWT_SECRET manquant : copiez .env.example en .env et renseignez-le.');
  }

  // E06 : on se connecte à la base AVANT d'accepter des requêtes.
  await AppDataSource.initialize();
  console.log(`Base de données : ${config.dbPath}`);

  // app.listen crée le serveur (http.createServer(app)) et le met à l'écoute.
  app.listen(config.port, () => {
    console.log(`EduTrack écoute sur http://localhost:${config.port} (${config.env})`);
  });
}

main().catch((error) => {
  console.error('❌ Démarrage impossible :', error.message);
  process.exit(1);
});
