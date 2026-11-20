// Entité User (E06) : décrit la table « users » pour TypeORM.
//
// EntitySchema décrit une table avec un simple objet JavaScript. (En
// TypeScript, on utilise plutôt des classes avec des décorateurs @Entity,
// @Column… : même résultat.)
const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'User', // nom utilisé dans le code : getRepository('User')
  tableName: 'users', // nom de la table en base

  columns: {
    id: { type: 'integer', primary: true, generated: true }, // clé primaire auto-incrémentée
    email: { type: 'varchar', length: 255, unique: true }, // contrainte UNIQUE
    passwordHash: { type: 'varchar', length: 255 },
    name: { type: 'varchar', length: 100 },
    role: { type: 'varchar', length: 20 },
  },

  // Contrainte CHECK : la base refuse tout autre rôle
  checks: [{ expression: `role IN ('trainer', 'student')` }],
});
