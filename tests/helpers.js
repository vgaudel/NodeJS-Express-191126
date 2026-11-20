// =============================================================================
// tests/helpers.js — Données et outils partagés par les tests (E08)
// =============================================================================
//
// Ce module regroupe ce dont plusieurs fichiers de test ont besoin :
//  - les « fixtures » : un jeu de données connu, inséré avant chaque test ;
//  - des jetons d'authentification prêts à l'emploi ;
//  - une fabrique de quiz valides.
//
// Les centraliser évite de recopier les mêmes données dans chaque fichier,
// et garantit que tous les tests parlent des mêmes utilisateurs et des
// mêmes quiz.
// =============================================================================
'use strict';

const jwt = require('jsonwebtoken');
const config = require('../src/config');
const userRepository = require('../src/repositories/user.repository');
const quizRepository = require('../src/repositories/quiz.repository');
const { hashPassword } = require('../src/services/password.service');

// Mot de passe commun aux utilisateurs de test (exporté pour le test de /login).
const PASSWORD = 'MotDePasse123!';

// Le hachage est calculé une seule fois, puis réutilisé à chaque test.
// scrypt est volontairement lent (c'est ce qui freine les attaques par force
// brute) : le recalculer avant chacun des tests ralentirait toute la suite.
let passwordHash;

// -----------------------------------------------------------------------------
// Identifiants CONNUS à l'avance
// -----------------------------------------------------------------------------
// La base est recréée avant chaque test et les données sont toujours insérées
// dans le même ordre : SQLite attribue donc toujours les mêmes id (1, 2, …).
// Les tests peuvent s'y fier au lieu de les rechercher.
//
// Object.freeze empêche un test de modifier ces valeurs par erreur.
const IDS = Object.freeze({
  trainer: 1, // formateur
  student: 2, // apprenant
  publishedQuiz: 1, // questions 1 et 2 ; réponses 1 à 4 ; bonnes réponses : 1 et 3
  draftQuiz: 2, // question 3 ; réponses 5 et 6 ; bonne réponse : 5
});

// -----------------------------------------------------------------------------
// loadFixtures : insère le jeu de données de départ
// -----------------------------------------------------------------------------
// Appelée par le hook beforeEach de setup.js, avant chaque test.
// On passe par les repositories de l'application plutôt que par du SQL brut :
// les données sont ainsi enregistrées exactement comme en conditions réelles.
async function loadFixtures() {
  // ??= : affectation seulement si la variable est encore vide (null ou undefined).
  // Le hachage est donc calculé au premier appel, et réutilisé ensuite.
  passwordHash ??= await hashPassword(PASSWORD);

  // Deux utilisateurs, un par rôle. L'ordre compte : il fixe les id (voir IDS).
  for (const user of [
    { email: 'trainer@test.local', name: 'Formateur', role: 'trainer' },
    { email: 'student@test.local', name: 'Apprenant', role: 'student' },
  ]) {
    await userRepository.create({ ...user, passwordHash });
  }

  // Quiz 1 : publié, visible par tout le monde.
  await quizRepository.create({
    title: 'Quiz publié',
    published: true,
    questions: [
      { statement: 'Q1', answers: [{ label: 'Bonne', isCorrect: true }, { label: 'Fausse', isCorrect: false }] },
      { statement: 'Q2', answers: [{ label: 'Bonne', isCorrect: true }, { label: 'Fausse', isCorrect: false }] },
    ],
  });

  // Quiz 2 : brouillon, visible seulement par les formateurs.
  await quizRepository.create({
    title: 'Brouillon',
    published: false,
    questions: [{ statement: 'Q3', answers: [{ label: 'Oui', isCorrect: true }, { label: 'Non', isCorrect: false }] }],
  });
}

// -----------------------------------------------------------------------------
// Jetons d'authentification
// -----------------------------------------------------------------------------
// On fabrique directement un JWT valide, signé avec le secret de test.
// C'est plus rapide que d'appeler POST /api/auth/login avant chaque test
// (et cela évite qu'un bug de /login fasse échouer TOUS les tests).
// La connexion elle-même est testée à part, dans auth.api.test.js.
function tokenFor(id, role) {
  return jwt.sign({ sub: id, role, name: 'test' }, config.jwtSecret, { expiresIn: '5m' });
}

// Valeurs prêtes à placer dans l'en-tête HTTP « Authorization ».
// Usage dans un test : request(app).get(...).set('Authorization', auth.trainer)
const auth = {
  trainer: `Bearer ${tokenFor(IDS.trainer, 'trainer')}`,
  student: `Bearer ${tokenFor(IDS.student, 'student')}`,
};

// -----------------------------------------------------------------------------
// validQuiz : fabrique de données de test
// -----------------------------------------------------------------------------
// Renvoie un quiz VALIDE par défaut. Chaque test ne précise que ce qui
// l'intéresse, grâce à « overrides » qui remplace les champs voulus :
//
//   validQuiz()                   → quiz valide, tel quel
//   validQuiz({ title: 'ab' })    → même quiz, mais avec un titre trop court
//
// Le test reste court, et l'on voit tout de suite ce qu'il cherche à vérifier.
function validQuiz(overrides = {}) {
  return {
    title: 'Nouveau quiz',
    questions: [{ statement: 'Combien font 2 + 2 ?', answers: [{ label: '4', isCorrect: true }, { label: '5', isCorrect: false }] }],
    ...overrides, // les propriétés passées en paramètre écrasent celles du dessus
  };
}

module.exports = { PASSWORD, IDS, auth, validQuiz, loadFixtures };
