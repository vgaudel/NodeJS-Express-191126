// Entité Question (E06) : table « questions ».
const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'Question',
  tableName: 'questions',

  columns: {
    id: { type: 'integer', primary: true, generated: true },
    statement: { type: 'text' },
    position: { type: 'integer' }, // ordre d'affichage dans le quiz
    quizId: { type: 'integer' }, // la clé étrangère, aussi accessible comme un champ
  },

  relations: {
    // PLUSIEURS questions appartiennent à UN quiz (« plusieurs-à-un »).
    // C'est ce côté qui porte la clé étrangère (colonne quizId).
    quiz: {
      type: 'many-to-one',
      target: 'Quiz',
      inverseSide: 'questions',
      joinColumn: { name: 'quizId' },
      nullable: false,
      onDelete: 'CASCADE', // supprimer le quiz supprime ses questions
    },
    answers: {
      type: 'one-to-many',
      target: 'Answer',
      inverseSide: 'question',
      cascade: true,
    },
  },
});
