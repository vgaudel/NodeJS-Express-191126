// Accès aux utilisateurs — version TypeORM (E06).
//
// Comparez avec la version JSON de E04 : même interface (findByEmail,
// findById), donc le service d'authentification ne change PAS.
// C'est tout l'intérêt du patron Repository.
const { AppDataSource } = require('../config/database');

// getRepository('User') donne un objet qui sait lire et écrire la table users.
// C'est une FONCTION : le repository n'existe qu'après AppDataSource.initialize().
const users = () => AppDataSource.getRepository('User');

async function findByEmail(email) {
  // findOneBy({ email }) génère : SELECT ... FROM users WHERE email = ? LIMIT 1
  // TypeORM utilise TOUJOURS des paramètres : pas d'injection SQL possible.
  return users().findOneBy({ email: email.toLowerCase() });
}

async function findById(id) {
  return users().findOneBy({ id });
}

async function create(data) {
  return users().save(data); // INSERT, puis renvoie l'objet avec son id
}

module.exports = { findByEmail, findById, create };
