// Entité Answer (E06) : table « answers ».
const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'Answer',
  tableName: 'answers',

  columns: {
    id: { type: 'integer', primary: true, generated: true },
    label: { type: 'varchar', length: 200 },
    isCorrect: { type: 'boolean', default: false },
    questionId: { type: 'integer' },
  },

  relations: {
    question: {
      type: 'many-to-one',
      target: 'Question',
      inverseSide: 'answers',
      joinColumn: { name: 'questionId' },
      nullable: false,
      onDelete: 'CASCADE',
    },
  },
});
