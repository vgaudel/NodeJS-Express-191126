// Entité Quiz (E06) : table « quizzes ».
const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'Quiz',
  tableName: 'quizzes',

  columns: {
    id: { type: 'integer', primary: true, generated: true },
    title: { type: 'varchar', length: 120 },
    description: { type: 'text', default: '' },
    published: { type: 'boolean', default: false }, // SQLite le stocke en 0 / 1
    createdAt: { type: 'datetime', createDate: true }, // rempli automatiquement à l'insertion
  },

  relations: {
    // Un quiz a PLUSIEURS questions (relation « un-à-plusieurs »).
    questions: {
      type: 'one-to-many',
      target: 'Question',
      inverseSide: 'quiz', // nom de la relation inverse, dans Question
      cascade: true, // enregistrer un quiz enregistre aussi ses questions
    },
  },
});
