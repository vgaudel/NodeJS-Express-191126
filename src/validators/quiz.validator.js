// Validation des données reçues (E02) — règles des spécifications §5.
//
// Chaque validateur est une fonction PURE : il reçoit les données et renvoie
// la liste des problèmes trouvés (tableau vide = données valides). Il ne
// connaît ni Express ni HTTP : facile à tester (jour 4).

const isNonEmptyString = (value, max) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;

function validateTitle(title, errors) {
  if (typeof title !== 'string' || title.trim().length < 3 || title.length > 120) {
    errors.push('title : chaîne de 3 à 120 caractères obligatoire');
  }
}

function validateDescription(description, errors) {
  if (description !== undefined && (typeof description !== 'string' || description.length > 500)) {
    errors.push('description : chaîne de 500 caractères au maximum');
  }
}

function validatePublished(published, errors) {
  if (published !== undefined && typeof published !== 'boolean') {
    errors.push('published : true ou false');
  }
}

// Création d'un quiz complet (POST /api/quizzes)
function validateQuiz(data) {
  const errors = [];
  validateTitle(data.title, errors);
  validateDescription(data.description, errors);
  validatePublished(data.published, errors);

  if (!Array.isArray(data.questions) || data.questions.length === 0) {
    errors.push('questions : au moins une question');
    return errors; // inutile de détailler des questions absentes
  }

  data.questions.forEach((question, i) => {
    const where = `questions[${i}]`; // localise l'erreur pour l'utilisateur
    if (!isNonEmptyString(question?.statement, 500)) {
      errors.push(`${where}.statement : énoncé obligatoire (500 caractères au plus)`);
    }
    const answers = question?.answers;
    if (!Array.isArray(answers) || answers.length < 2 || answers.length > 6) {
      errors.push(`${where}.answers : nécessité d'avoir de 2 à 6 réponses`);
      return; // passe à la question suivante
    }
    answers.forEach((answer, j) => {
      if (!isNonEmptyString(answer?.label, 200)) {
        errors.push(`${where}.answers[${j}].label : libellé obligatoire (200 caractères au plus)`);
      }
      if (typeof answer?.isCorrect !== 'boolean') {
        errors.push(`${where}.answers[${j}].isCorrect : true ou false`);
      }
    });
    if (answers.filter((a) => a?.isCorrect === true).length !== 1) {
      errors.push(`${where}.answers : exactement une réponse correcte`);
    }
  });
  return errors;
}

// Modification (PATCH) : seuls title, description et published sont modifiables
function validateQuizUpdate(data) {
  const errors = [];
  const allowed = ['title', 'description', 'published'];
  const keys = Object.keys(data);

  if (keys.length === 0) errors.push('aucun champ à modifier');
  for (const key of keys) {
    if (!allowed.includes(key)) errors.push(`${key} : champ non modifiable`);
  }
  if ('title' in data) validateTitle(data.title, errors);
  validateDescription(data.description, errors);
  validatePublished(data.published, errors);
  return errors;
}

// Soumission des réponses : { answers: [{ questionId, answerId }] }
function validateSubmission(data) {
  if (!Array.isArray(data.answers)) return ['answers : tableau obligatoire'];
  const errors = [];
  data.answers.forEach((a, i) => {
    if (!Number.isInteger(a?.questionId)) errors.push(`answers[${i}].questionId : entier obligatoire`);
    if (a?.answerId !== null && !Number.isInteger(a?.answerId)) {
      errors.push(`answers[${i}].answerId : entier ou null`);
    }
  });
  return errors;
}

module.exports = { validateQuiz, validateQuizUpdate, validateSubmission };
