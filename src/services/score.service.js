// Calcul du score d'un quiz (A03) — fonction PURE :
// elle ne lit et n'écrit rien d'extérieur, et renvoie toujours le même
// résultat pour les mêmes paramètres. Elle est donc facile à tester.
//
// Règles (spécifications §5) :
//  - 1 point par question dont la réponse choisie est correcte ;
//  - une question sans réponse compte faux ;
//  - scoreOn20 = note ramenée sur 20, arrondie à 2 décimales.

/**
 * @param {object} quiz       le quiz complet (avec les bonnes réponses)
 * @param {Array<{questionId: number, answerId: number}>} responses
 * @returns {{score: number, maxScore: number, scoreOn20: number, corrections: object[]}}
 */
function computeScore(quiz, responses) {
  // Pour chaque question, on construit une ligne de correction.
  const corrections = quiz.questions.map((question) => {
    const response = responses.find((r) => r.questionId === question.id);
    const answerId = response ? response.answerId : null;
    const correctAnswer = question.answers.find((a) => a.isCorrect);
    return {
      questionId: question.id,
      answerId,
      correctAnswerId: correctAnswer.id,
      correct: answerId === correctAnswer.id,
    };
  });

  const score = corrections.filter((c) => c.correct).length;
  const maxScore = quiz.questions.length;
  const scoreOn20 = maxScore === 0 ? 0 : Math.round((score / maxScore) * 20 * 100) / 100;

  return { score, maxScore, scoreOn20, corrections };
}

module.exports = { computeScore };
