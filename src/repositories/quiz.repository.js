// Accès aux quiz — version TypeORM (E07).
//
// Même interface que la version JSON (findAll, findById, save, create,
// remove) : le service des quiz ne change (presque) pas.
const { AppDataSource } = require('../config/database');

const quizzes = () => AppDataSource.getRepository('Quiz');

// Options de lecture communes : charger les questions et leurs réponses
// (relations), dans l'ordre (order). Sans ORDER BY, SQL ne garantit AUCUN ordre.
const WITH_QUESTIONS = {
  relations: { questions: { answers: true } },
  order: { id: 'ASC', questions: { position: 'ASC', answers: { id: 'ASC' } } },
};

async function findAll() {
  return quizzes().find(WITH_QUESTIONS);
}

async function findById(id) {
  // findOne + where : une seule ligne ; null si aucun quiz ne correspond
  return quizzes().findOne({ where: { id }, ...WITH_QUESTIONS });
}

// Enregistre les modifications d'un quiz existant (UPDATE).
async function save(quiz) {
  return quizzes().save(quiz);
}

// Crée un quiz AVEC ses questions et ses réponses, en une seule opération.
// Grâce à « cascade: true » (entités Quiz et Question), TypeORM insère le quiz,
// puis les questions, puis les réponses, dans une TRANSACTION : si une
// insertion échoue, rien n'est enregistré.
//
// manager : par défaut, le gestionnaire global. Le seed passe celui d'une
// transaction englobante pour importer tous les quiz en « tout ou rien ».
async function create(data, manager = AppDataSource.manager) {
  const repository = manager.getRepository('Quiz');
  const saved = await repository.save({
    ...data,
    // L'ordre des questions est mémorisé dans la colonne position
    questions: data.questions.map((question, index) => ({ ...question, position: index + 1 })),
  });
  // On relit le quiz pour renvoyer la même forme que findById (id, createdAt…)
  return repository.findOne({ where: { id: saved.id }, ...WITH_QUESTIONS });
}

// Supprime un quiz ; ses questions et réponses suivent (ON DELETE CASCADE).
async function remove(id) {
  const result = await quizzes().delete(id);
  return result.affected > 0; // nombre de lignes supprimées
}

module.exports = { findAll, findById, save, create, remove };
