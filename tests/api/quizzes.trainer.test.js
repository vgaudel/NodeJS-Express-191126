// =============================================================================
// tests/api/quizzes.trainer.test.js — Tests d'INTÉGRATION : gestion des quiz
// par les formateurs (E08)
// =============================================================================
//
// Ces tests couvrent les routes réservées aux formateurs : créer, modifier,
// supprimer un quiz. Pour chaque action, on vérifie :
//  - les DROITS  : 401 sans jeton, 403 pour un apprenant ;
//  - le RÉSULTAT : statut, en-têtes, corps de la réponse ;
//  - l'EFFET en base : ce qui a réellement été enregistré ou supprimé.
//
// Rappel des codes de statut utilisés :
//   200 OK              201 Created            204 No Content (rien à renvoyer)
//   400 Bad Request     401 Unauthorized       403 Forbidden
//   404 Not Found       405 Method Not Allowed
// =============================================================================
const { expect } = require('chai');
const request = require('supertest');
const app = require('../../src/app');
const { AppDataSource } = require('../../src/config/database'); // pour interroger la base directement
const { IDS, auth, validQuiz } = require('../helpers');

describe('Créer un quiz', () => {
  // 401 et 403 : deux refus différents.
  //  - 401 : « je ne sais pas qui vous êtes » (pas de jeton) ;
  //  - 403 : « je sais qui vous êtes, mais vous n'avez pas le droit ».
  it('répond 401 sans jeton et 403 pour un apprenant', async () => {
    await request(app).post('/api/quizzes').send(validQuiz()).expect(401);
    await request(app).post('/api/quizzes').set('Authorization', auth.student).send(validQuiz()).expect(403);
  });

  it('crée un brouillon (201 + Location) et ignore un id envoyé par le client', async () => {
    const res = await request(app)
      .post('/api/quizzes')
      .set('Authorization', auth.trainer)
      .send(validQuiz({ id: IDS.publishedQuiz })) // tentative d'écraser le quiz 1 : doit être ignorée
      .expect(201)
      // On peut enchaîner plusieurs .expect(). Ici, un en-tête comparé à une
      // expression régulière : l'URL exacte dépend de l'id attribué.
      .expect('Location', /\/api\/quizzes\/\d+$/);

    // Sans précision, un nouveau quiz est un brouillon.
    expect(res.body).to.include({ title: 'Nouveau quiz', published: false });
    expect(res.body.id).to.not.equal(IDS.publishedQuiz); // c'est la base qui attribue l'id
    expect(res.body.createdAt).to.be.a('string'); // date remplie par la base (colonne createDate)
  });

  // Test « aller-retour » : on crée par POST, puis on relit par GET.
  // On vérifie ainsi ce qui a vraiment été enregistré, pas seulement ce que
  // la création a répondu.
  it("conserve l'ordre des questions", async () => {
    const statements = ['Première', 'Deuxième', 'Troisième'];
    const answers = [{ label: 'a', isCorrect: true }, { label: 'b', isCorrect: false }];

    const created = await request(app)
      .post('/api/quizzes')
      .set('Authorization', auth.trainer)
      // published: true pour pouvoir le relire sans jeton juste après
      .send(validQuiz({ published: true, questions: statements.map((statement) => ({ statement, answers })) }))
      .expect(201);

    const res = await request(app).get(`/api/quizzes/${created.body.id}`).expect(200);
    // map : on extrait les énoncés, puis on compare les deux tableaux, ordre compris.
    expect(res.body.questions.map((q) => q.statement)).to.deep.equal(statements);
  });

  // Une bonne API ne se contente pas de dire « non » : elle explique pourquoi.
  it('répond 400 avec le détail des erreurs', async () => {
    const res = await request(app)
      .post('/api/quizzes')
      .set('Authorization', auth.trainer)
      .send(validQuiz({ title: 'ab', questions: [] })) // deux erreurs volontaires
      .expect(400);
    // Les deux erreurs sont signalées EN MÊME TEMPS : l'utilisateur peut tout
    // corriger d'un coup, sans renvoyer le formulaire plusieurs fois.
    expect(res.body.details).to.have.lengthOf(2);
  });
});

describe('Modifier et supprimer un quiz', () => {
  // PATCH : modification partielle, on n'envoie que le champ qui change.
  it('publie un brouillon', async () => {
    await request(app)
      .patch(`/api/quizzes/${IDS.draftQuiz}`)
      .set('Authorization', auth.trainer)
      .send({ published: true })
      .expect(200);
    // On vérifie l'EFFET : sans jeton, le quiz est désormais visible.
    await request(app).get(`/api/quizzes/${IDS.draftQuiz}`).expect(200);
  });

  it('répond 403 pour un apprenant et 400 pour un champ non modifiable', async () => {
    // Un apprenant n'a pas le droit de modifier un quiz.
    await request(app)
      .patch(`/api/quizzes/${IDS.publishedQuiz}`)
      .set('Authorization', auth.student)
      .send({ title: 'Piraté' })
      .expect(403);
    // Un formateur a le droit, mais pas de changer l'id.
    await request(app)
      .patch(`/api/quizzes/${IDS.publishedQuiz}`)
      .set('Authorization', auth.trainer)
      .send({ id: 99 })
      .expect(400);
  });

  it('supprime un quiz et ses questions (204), puis 404', async () => {
    // 1re suppression : réussie, rien à renvoyer (204).
    await request(app).delete(`/api/quizzes/${IDS.publishedQuiz}`).set('Authorization', auth.trainer).expect(204);
    // 2e suppression : le quiz n'existe plus (404).
    await request(app).delete(`/api/quizzes/${IDS.publishedQuiz}`).set('Authorization', auth.trainer).expect(404);

    // On vérifie directement dans la base, sans passer par l'API :
    // grâce à ON DELETE CASCADE, les questions du quiz ont été supprimées avec lui.
    // Sans cette règle, elles resteraient « orphelines » dans la table.
    const left = await AppDataSource.getRepository('Question').countBy({ quizId: IDS.publishedQuiz });
    expect(left).to.equal(0);
  });

  // 405 : la route existe, mais pas pour cette méthode. L'en-tête Allow
  // indique au client les méthodes qu'il peut utiliser.
  it('répond 405 pour une méthode non prévue', async () => {
    await request(app).put(`/api/quizzes/${IDS.publishedQuiz}`).expect(405).expect('Allow', 'GET, PATCH, DELETE');
  });
});
