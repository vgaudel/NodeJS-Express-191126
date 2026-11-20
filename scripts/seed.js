// Réinitialise la base de démonstration (E02 ; comptes en E04 ; base de données en E06-E07).
// Lancement :  npm run seed                     → réinitialise TOUT
//              node scripts/seed.js --if-missing → seulement si la base n'existe pas
//                (lancé automatiquement avant « npm start » et « npm run dev » :
//                 scripts « prestart » et « predev » de package.json)
//
// 1. supprime et recrée toutes les tables ;
// 2. crée les comptes de démonstration (mots de passe hachés) ;
// 3. importe les quiz de data/seed-quizzes.json, dans UNE transaction.
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const config = require('../src/config');
const { AppDataSource } = require('../src/config/database');
const userRepository = require('../src/repositories/user.repository');
const quizRepository = require('../src/repositories/quiz.repository');
const { hashPassword } = require('../src/services/password.service');

const SEED_FILE = path.join(__dirname, '..', 'data', 'seed-quizzes.json');
const IF_MISSING = process.argv.includes('--if-missing');

// La base existe-t-elle déjà ?
async function exists(file) {
  try {
    await fs.access(file); // lève une erreur si le fichier n'existe pas
    return true;
  } catch {
    return false;
  }
}

// Comptes de démonstration (les mots de passe en clair n'existent qu'ici)
const DEMO_USERS = [
  { email: 'formateur@edutrack.local', password: 'Formateur123!', name: 'Formateur principal', role: 'trainer' },
  { email: 'formateur2@edutrack.local', password: 'Formateur123!', name: 'Second formateur', role: 'trainer' },
  { email: 'alice@edutrack.local', password: 'Apprenant123!', name: 'Alice', role: 'student' },
];

async function main() {
  if (IF_MISSING && (await exists(config.dbPath))) return;

  await AppDataSource.initialize();
  // synchronize(true) : SUPPRIME toutes les tables puis les recrée, vides.
  await AppDataSource.synchronize(true);

  // 1. Les utilisateurs
  for (const { password, ...user } of DEMO_USERS) {
    await userRepository.create({ ...user, passwordHash: await hashPassword(password) });
  }
  console.log(`✅ ${DEMO_USERS.length} comptes créés`);

  // 2. Les quiz. Le fichier contient des identifiants : on les retire, c'est
  //    la base qui les attribue (dans le même ordre, donc les mêmes valeurs).
  const data = JSON.parse(await fs.readFile(SEED_FILE, 'utf8'));

  // AppDataSource.transaction : toutes les écritures faites avec « manager »
  // sont validées ensemble à la fin… ou annulées ensemble en cas d'erreur.
  await AppDataSource.transaction(async (manager) => {
    for (const quiz of data) {
      await quizRepository.create(
        {
          title: quiz.title,
          description: quiz.description,
          published: quiz.published,
          createdAt: new Date(quiz.createdAt),
          questions: quiz.questions.map((q) => ({
            statement: q.statement,
            answers: q.answers.map((a) => ({ label: a.label, isCorrect: a.isCorrect })),
          })),
        },
        manager, // ← toutes les écritures passent par la transaction
      );
    }
  });
  console.log(`✅ ${data.length} quiz importés dans ${config.dbPath}`);
}

main()
  .catch((error) => {
    console.error('❌ Seed impossible :', error.message);
    process.exitCode = 1;
  })
  // finally : on ferme la connexion dans tous les cas, sinon le script ne s'arrête pas
  .finally(() => AppDataSource.isInitialized && AppDataSource.destroy());
