// Réinitialise les données de démonstration (E02 ; comptes utilisateurs en E04).
// Lancement :  npm run seed                     → réinitialise TOUT
//              node scripts/seed.js --if-missing → crée seulement les fichiers absents
//                (lancé automatiquement avant « npm start » et « npm run dev » :
//                 scripts « prestart » et « predev » de package.json)
//
// - data/seed-quizzes.json (versionné) → data/quizzes.json (fichier de travail)
// - comptes de démonstration → data/users.json, mots de passe HACHÉS
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { hashPassword } = require('../src/services/password.service');

const DATA_DIR = path.join(__dirname, '..', 'data');
const QUIZZES_FILE = path.join(DATA_DIR, 'quizzes.json');
const IF_MISSING = process.argv.includes('--if-missing');

// Faut-il (re)créer ce fichier ? Toujours, sauf avec --if-missing s'il existe déjà.
async function mustCreate(file) {
  if (!IF_MISSING) return true;
  try {
    await fs.access(file); // lève une erreur si le fichier n'existe pas
    return false;
  } catch {
    return true;
  }
}

// Comptes de démonstration (les mots de passe en clair n'existent qu'ici)
const DEMO_USERS = [
  { email: 'formateur@edutrack.local', password: 'Formateur123!', name: 'Formateur principal', role: 'trainer' },
  { email: 'formateur2@edutrack.local', password: 'Formateur123!', name: 'Second formateur', role: 'trainer' },
  { email: 'alice@edutrack.local', password: 'Apprenant123!', name: 'Alice', role: 'student' },
];

async function main() {
  // 1. Les quiz
  if (await mustCreate(QUIZZES_FILE)) {
    await fs.copyFile(path.join(DATA_DIR, 'seed-quizzes.json'), QUIZZES_FILE);
    console.log('✅ data/quizzes.json réinitialisé');
  }

  const usersFile = path.join(DATA_DIR, 'users.json');
  if (!(await mustCreate(usersFile))) return;

  // 2. Les utilisateurs : on hache les mots de passe EN PARALLÈLE (Promise.all, vu en A06)
  const users = await Promise.all(
    DEMO_USERS.map(async ({ password, ...user }, index) => ({
      id: index + 1,
      ...user,
      passwordHash: await hashPassword(password),
    })),
  );
  await fs.writeFile(usersFile, JSON.stringify(users, null, 2) + '\n');
  console.log(`✅ ${users.length} comptes créés dans data/users.json`);
}

main().catch((error) => {
  console.error('❌ Seed impossible :', error.message);
  process.exitCode = 1;
});
