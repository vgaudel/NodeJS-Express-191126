// =============================================================================
// tests/setup.js — Préparation commune à TOUS les tests (E08)
// =============================================================================
//
// Ce fichier n'est pas un fichier de test : il ne contient aucun describe/it.
// Mocha le charge AVANT les fichiers de test, grâce à l'option « require »
// de .mocharc.jsonc :
//
//   {
//     "spec": "tests/**/*.test.js",   ← les fichiers de test à exécuter
//     "require": "tests/setup.js",    ← chargé en premier
//     "timeout": 10000                ← un test échoue s'il dure plus de 10 s
//   }
//
// Son rôle : mettre l'application dans un état « de test » (configuration,
// base de données) avant que le premier test ne démarre.
// =============================================================================
'use strict';

// -----------------------------------------------------------------------------
// 1. Configuration de test
// -----------------------------------------------------------------------------
// Ces lignes doivent venir AVANT tout require de l'application.
// Pourquoi ? src/config lit process.env au moment où il est chargé, puis Node
// le garde en cache : un second require renvoie le même objet, sans relire
// process.env. Si on modifiait les variables après coup, il serait trop tard.
process.env.NODE_ENV = 'test'; // désactive Morgan, le journal des requêtes (voir app.js)
process.env.DB_PATH = ':memory:'; // base SQLite EN MÉMOIRE : rapide, isolée, jetable
process.env.JWT_SECRET = 'secret-reserve-aux-tests'; // jamais le secret de production

// On peut maintenant charger le code de l'application en toute sécurité.
const { AppDataSource } = require('../src/config/database');
const { loadFixtures } = require('./helpers');

// -----------------------------------------------------------------------------
// 2. « Root hooks » : des hooks Mocha qui s'appliquent à TOUS les tests
// -----------------------------------------------------------------------------
// Un hook est une fonction que Mocha exécute automatiquement à un moment
// précis du cycle de vie des tests :
//
//   beforeAll   → une fois, avant le tout premier test
//   beforeEach  → avant CHAQUE test
//   afterEach   → après CHAQUE test (non utilisé ici)
//   afterAll    → une fois, après le dernier test
//
// Placés dans un describe, ces hooks ne valent que pour ce bloc. Exportés
// ici sous le nom « mochaHooks », ils valent pour toute la suite.
//
// Les fonctions sont async : Mocha attend la fin de la promesse avant de
// passer à la suite.
exports.mochaHooks = {
  async beforeAll() {
    // Ouvre la connexion à la base, une seule fois pour toute la suite.
    await AppDataSource.initialize();
  },

  async beforeEach() {
    // Avant CHAQUE test, on repart d'une base neuve :
    //  - synchronize(true) supprime toutes les tables puis les recrée
    //    à partir des entités (true = « supprimer d'abord ») ;
    //  - loadFixtures() insère un jeu de données connu (voir helpers.js).
    //
    // Conséquence importante : les tests sont INDÉPENDANTS. Un test qui
    // supprime un quiz ne gêne pas le suivant, et l'ordre d'exécution
    // n'a aucune influence sur le résultat.
    await AppDataSource.synchronize(true);
    await loadFixtures();
  },

  async afterAll() {
    // Ferme la connexion. Sans cela, la connexion ouverte empêche
    // Node de s'arrêter et Mocha ne rend pas la main à la fin des tests.
    await AppDataSource.destroy();
  },
};
