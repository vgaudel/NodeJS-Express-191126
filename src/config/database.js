// Connexion à la base de données avec TypeORM (E06).
//
// Un DataSource décrit la connexion : type de base, emplacement, entités.
// Il faut l'initialiser (await AppDataSource.initialize()) avant toute requête.
const { DataSource } = require('typeorm');
const config = require('./index');
const User = require('../entities/User');
const Quiz = require('../entities/Quiz');
const Question = require('../entities/Question');
const Answer = require('../entities/Answer');

const AppDataSource = new DataSource({
  type: 'better-sqlite3', // le pilote installé en E05
  database: config.dbPath, // fichier .db, ou ':memory:' (base en mémoire, pour les tests)
  entities: [User, Quiz, Question, Answer],

  // synchronize : TypeORM crée ou modifie les tables pour qu'elles
  // correspondent aux entités, à chaque démarrage. Très pratique en
  // développement… mais DANGEREUX en production (il peut supprimer des
  // colonnes, donc des données) : on y utilise des MIGRATIONS.
  synchronize: true,

  logging: false, // true : affiche chaque requête SQL générée (instructif !)
});

module.exports = { AppDataSource };
