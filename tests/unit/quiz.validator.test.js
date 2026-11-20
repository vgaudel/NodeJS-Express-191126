// =============================================================================
// tests/unit/quiz.validator.test.js — Tests UNITAIRES des validateurs (E08)
// =============================================================================
//
// On teste ici les règles de validation écrites en E02.
// Chaque validateur est une fonction pure qui renvoie un TABLEAU d'erreurs :
//   - tableau vide        → données valides ;
//   - tableau non vide    → un message par problème trouvé.
//
// Ces fonctions ne connaissent ni Express ni HTTP : on les appelle
// directement, comme n'importe quelle fonction JavaScript.
//
// Méthode suivie : partir d'un quiz VALIDE (validQuiz), puis changer UN seul
// champ par test. Si le test échoue, on sait exactement quelle règle est en cause.
// =============================================================================
const { expect } = require('chai');
const { validateQuiz, validateQuizUpdate, validateSubmission } = require('../../src/validators/quiz.validator');
const { validQuiz } = require('../helpers');

// --- Création d'un quiz (POST /api/quizzes) ----------------------------------
describe('validateQuiz', () => {
  // Toujours commencer par le cas valide : il prouve que la fabrique validQuiz
  // produit bien des données correctes. Les tests suivants en dépendent.
  it("n'a aucune erreur pour un quiz valide", () => {
    // Les assertions Chai se lisent comme une phrase :
    // « attends-toi à ce que le résultat soit un tableau, qui est vide ».
    expect(validateQuiz(validQuiz())).to.be.an('array').that.is.empty;
  });

  it('refuse un titre trop court', () => {
    // Le titre doit faire au moins 3 caractères : 'ab' n'en a que 2.
    // lengthOf(1) : une seule erreur, celle du titre (le reste est valide).
    expect(validateQuiz(validQuiz({ title: 'ab' }))).to.have.lengthOf(1);
  });

  it('refuse un quiz sans question', () => {
    // to.include sur un tableau : le tableau contient cet élément.
    // On vérifie le message exact, car c'est lui que l'utilisateur lira.
    expect(validateQuiz(validQuiz({ questions: [] }))).to.include('questions : au moins une question');
  });

  it('exige exactement une bonne réponse par question', () => {
    // Deux réponses marquées correctes : c'est interdit.
    const quiz = validQuiz({
      questions: [{ statement: 'Q', answers: [{ label: 'a', isCorrect: true }, { label: 'b', isCorrect: true }] }],
    });
    // questions[0] : le message indique QUELLE question pose problème.
    expect(validateQuiz(quiz)).to.include('questions[0].answers : exactement une réponse correcte');
  });

  it('exige de 2 à 6 réponses', () => {
    // Une seule réponse : en dessous du minimum.
    const quiz = validQuiz({ questions: [{ statement: 'Q', answers: [{ label: 'a', isCorrect: true }] }] });
    expect(validateQuiz(quiz)).to.include("questions[0].answers : nécessité d'avoir de 2 à 6 réponses");
  });
});

// --- Modification d'un quiz (PATCH /api/quizzes/:id) -------------------------
// Seuls title, description et published peuvent être modifiés.
describe('validateQuizUpdate', () => {
  it('accepte une simple publication', () => {
    expect(validateQuizUpdate({ published: true })).to.be.empty;
  });

  it('refuse un champ non modifiable', () => {
    // Changer l'id d'un quiz n'a pas de sens : la base l'attribue.
    expect(validateQuizUpdate({ id: 2 })).to.include('id : champ non modifiable');
  });

  it('refuse une modification vide', () => {
    // deep.equal : le tableau contient CE message et rien d'autre.
    expect(validateQuizUpdate({})).to.deep.equal(['aucun champ à modifier']);
  });
});

// --- Soumission des réponses (POST /api/quizzes/:id/submit) -------------------
describe('validateSubmission', () => {
  it('exige un tableau answers', () => {
    expect(validateSubmission({})).to.deep.equal(['answers : tableau obligatoire']);
  });

  it('accepte une réponse vide (null)', () => {
    // answerId: null = « je ne sais pas » : c'est permis, la question
    // sera simplement comptée fausse par computeScore.
    expect(validateSubmission({ answers: [{ questionId: 1, answerId: null }] })).to.be.empty;
  });
});
