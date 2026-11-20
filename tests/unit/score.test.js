// =============================================================================
// tests/unit/score.test.js — Tests UNITAIRES de computeScore (E08)
// =============================================================================
//
// Un test UNITAIRE vérifie une seule fonction, isolée du reste de l'application :
// pas de base de données, pas de serveur, pas de requête HTTP.
//
// computeScore s'y prête parfaitement : c'est une fonction PURE.
//  - Elle ne dépend que de ses paramètres (le quiz et les réponses).
//  - Elle ne modifie rien autour d'elle.
//  - Avec les mêmes paramètres, elle renvoie toujours le même résultat.
// Ces tests s'exécutent donc en quelques millisecondes.
//
// Vocabulaire Mocha, utilisé dans tous les fichiers :
//  - describe('…', () => { … })  regroupe des tests sur un même sujet ;
//  - it('…', () => { … })        définit UN test ; la phrase décrit le
//                                comportement attendu (« it » = « il… »).
// Un test réussit s'il se termine sans erreur ; il échoue dès qu'une
// assertion (expect) lève une erreur.
// =============================================================================
const { expect } = require('chai'); // Chai : la bibliothèque d'assertions
const { computeScore } = require('../../src/services/score.service');

// Un petit quiz écrit en dur pour les tests : 2 questions.
// Pas besoin de base de données : la fonction ne reçoit qu'un simple objet.
//   question 1 → bonne réponse : 10
//   question 2 → bonne réponse : 21
const quiz = {
  questions: [
    { id: 1, answers: [{ id: 10, isCorrect: true }, { id: 11, isCorrect: false }] },
    { id: 2, answers: [{ id: 20, isCorrect: false }, { id: 21, isCorrect: true }] },
  ],
};

describe('computeScore', () => {
  // Le cas nominal : tout est juste.
  it('donne 2/2, soit 20/20, quand toutes les réponses sont correctes', () => {
    const result = computeScore(quiz, [
      { questionId: 1, answerId: 10 },
      { questionId: 2, answerId: 21 },
    ]);
    // to.include({ … }) : l'objet contient AU MOINS ces propriétés avec ces
    // valeurs. Les autres propriétés (corrections…) ne sont pas vérifiées ici.
    expect(result).to.include({ score: 2, maxScore: 2, scoreOn20: 20 });
  });

  // Cas limite : l'apprenant n'a pas répondu à la question 2.
  it('compte faux une question sans réponse', () => {
    const result = computeScore(quiz, [{ questionId: 1, answerId: 10 }]);

    // to.equal : égalité stricte (===), pour les valeurs simples.
    expect(result.score).to.equal(1);

    // to.deep.equal : compare le CONTENU de deux objets, propriété par propriété.
    // Un simple to.equal échouerait : deux objets distincts ne sont jamais === .
    expect(result.corrections[1]).to.deep.equal({
      questionId: 2,
      answerId: null, // aucune réponse donnée
      correctAnswerId: 21, // la correction indique la bonne réponse
      correct: false,
    });
  });

  // Cas d'erreur : un identifiant de réponse qui n'existe pas dans le quiz.
  // La fonction ne doit pas planter : la réponse est simplement fausse.
  it('compte faux une réponse inconnue', () => {
    const result = computeScore(quiz, [{ questionId: 1, answerId: 999 }]);
    expect(result.score).to.equal(0);
  });

  // Règle de calcul : la note sur 20 est arrondie à deux décimales.
  it('arrondit la note sur 20 à deux décimales', () => {
    // On ajoute une 3e question au quiz de base (syntaxe de décomposition « ... »).
    const threeQuestions = { questions: [...quiz.questions, { id: 3, answers: [{ id: 30, isCorrect: true }] }] };
    const result = computeScore(threeQuestions, [{ questionId: 1, answerId: 10 }]);
    expect(result.scoreOn20).to.equal(6.67); // 1/3 × 20 = 6,666… arrondi à 6,67
  });
});
