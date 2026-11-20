// Réinitialise les données de démonstration (E02).
// Lancement :  npm run seed                     → réinitialise TOUT
//              node scripts/seed.js --if-missing → crée seulement les fichiers absents
//                (lancé automatiquement avant « npm start » et « npm run dev » :
//                 scripts « prestart » et « predev » de package.json)
//
// data/seed-quizzes.json (versionné, jamais modifié par l'API)
//   → data/quizzes.json (fichier de travail, modifié par POST, PATCH et DELETE)
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

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

async function main() {
  if (!(await mustCreate(QUIZZES_FILE))) return;
  await fs.copyFile(path.join(DATA_DIR, 'seed-quizzes.json'), QUIZZES_FILE);
  console.log('✅ data/quizzes.json réinitialisé');
}

main().catch((error) => {
  console.error('❌ Seed impossible :', error.message);
  process.exitCode = 1;
});
