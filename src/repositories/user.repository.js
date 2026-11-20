// Accès aux utilisateurs stockés dans data/users.json (E04).
// Même principe que le repository des quiz de A06 (fs/promises).
// Fichier créé par « npm run seed », avec des mots de passe HACHÉS.
const fs = require('node:fs/promises');
const path = require('node:path');

const FILE = path.join(__dirname, '..', '..', 'data', 'users.json');

async function findAll() {
  return JSON.parse(await fs.readFile(FILE, 'utf8'));
}

async function findByEmail(email) {
  const users = await findAll();
  return users.find((u) => u.email === email.toLowerCase()) ?? null;
}

async function findById(id) {
  const users = await findAll();
  return users.find((u) => u.id === id) ?? null;
}

module.exports = { findByEmail, findById };
