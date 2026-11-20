// Réinitialise les données de démonstration (E02 ; comptes en E04 ; base de données en E06).
// Lancement :  npm run seed                     → réinitialise TOUT
//              node scripts/seed.js --if-missing → crée seulement ce qui manque
//                (lancé automatiquement avant « npm start » et « npm run dev » :
//                 scripts « prestart » et « predev » de package.json)
//
// - les comptes de démonstration sont créés dans la BASE (table users) ;
// - data/seed-quizzes.json → data/quizzes.json (les quiz passent en base en E07).
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const config = require('../src/config');
const { AppDataSource } = require('../src/config/database');
const userRepository = require('../src/repositories/user.repository');
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
  // 1. Les quiz (encore en JSON)
  if (await mustCreate(QUIZZES_FILE)) {
    await fs.copyFile(path.join(DATA_DIR, 'seed-quizzes.json'), QUIZZES_FILE);
    console.log('✅ data/quizzes.json réinitialisé');
  }

  // 2. Les utilisateurs, dans la base
  if (!(await mustCreate(config.dbPath))) return;

  await AppDataSource.initialize();
  // synchronize(true) : SUPPRIME toutes les tables puis les recrée, vides.
  await AppDataSource.synchronize(true);

  for (const { password, ...user } of DEMO_USERS) {
    await userRepository.create({ ...user, passwordHash: await hashPassword(password) });
  }
  console.log(`✅ ${DEMO_USERS.length} comptes créés dans ${config.dbPath}`);
}

main()
  .catch((error) => {
    console.error('❌ Seed impossible :', error.message);
    process.exitCode = 1;
  })
  // finally : on ferme la connexion dans tous les cas, sinon le script ne s'arrête pas
  .finally(() => AppDataSource.isInitialized && AppDataSource.destroy());
