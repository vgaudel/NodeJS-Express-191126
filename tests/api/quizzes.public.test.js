// =============================================================================
// tests/api/quizzes.public.test.js — Tests d'INTÉGRATION : consulter et passer
// un quiz, sans compte (E08)
// =============================================================================
//
// Ces tests se placent du point de vue d'un visiteur ou d'un apprenant.
// Ils vérifient deux choses :
//  - ce que l'API MONTRE (quiz publiés seulement, sans les bonnes réponses) ;
//  - ce que l'API CALCULE (le score, toujours côté serveur).
//
// Données de départ (voir helpers.js) :
//   quiz 1 (publié)    : question 1 → réponses 1 (bonne) et 2
//                        question 2 → réponses 3 (bonne) et 4
//   quiz 2 (brouillon) : question 3 → réponses 5 (bonne) et 6
// =============================================================================
const { expect } = require('chai');
const request = require('supertest');
const app = require('../../src/app');
const { IDS, auth } = require('../helpers');

describe('Consulter les quiz (public)', () => {
  it('liste uniquement les quiz publiés', async () => {
    const res = await request(app).get('/api/quizzes').expect(200);

    // Sur 2 quiz en base, un seul est publié : le brouillon doit rester caché.
    expect(res.body).to.have.lengthOf(1);
    expect(res.body[0]).to.include({ id: IDS.publishedQuiz, questionCount: 2 });
  });

  // Même route, mais avec un jeton de formateur : le résultat change selon
  // QUI fait la requête.
  it('liste aussi les brouillons pour un formateur', async () => {
    const res = await request(app).get('/api/quizzes').set('Authorization', auth.trainer).expect(200);
    expect(res.body).to.have.lengthOf(2);
  });

  // Test de SÉCURITÉ : si isCorrect était envoyé au navigateur, il suffirait
  // d'ouvrir les outils de développement pour connaître les bonnes réponses.
  it("n'envoie jamais les bonnes réponses à un apprenant", async () => {
    const res = await request(app).get(`/api/quizzes/${IDS.publishedQuiz}`).expect(200);
    const answer = res.body.questions[0].answers[0];

    // all.keys : l'objet a EXACTEMENT ces clés, ni plus ni moins.
    // C'est plus sûr que de tester l'absence de isCorrect : toute propriété
    // ajoutée plus tard par erreur ferait aussi échouer le test.
    expect(answer).to.have.all.keys('id', 'label');
  });

  // On répond 404 (et non 403) au public : on ne révèle même pas que le
  // brouillon existe.
  it('cache les brouillons au public (404) mais pas au formateur', async () => {
    await request(app).get(`/api/quizzes/${IDS.draftQuiz}`).expect(404); // visiteur anonyme
    await request(app).get(`/api/quizzes/${IDS.draftQuiz}`).set('Authorization', auth.student).expect(404); // apprenant
    await request(app).get(`/api/quizzes/${IDS.draftQuiz}`).set('Authorization', auth.trainer).expect(200); // formateur
  });

  // « abc » n'est pas un nombre : la requête est mal formée (400), ce n'est
  // pas un quiz introuvable (404).
  it('répond 400 pour un identifiant invalide', async () => {
    await request(app).get('/api/quizzes/abc').expect(400);
  });
});

describe('POST /api/quizzes/:id/submit', () => {
  // Règle d'or : ne jamais faire confiance aux données envoyées par le client.
  it('calcule le score côté serveur et ignore un score envoyé par le client', async () => {
    const res = await request(app)
      .post(`/api/quizzes/${IDS.publishedQuiz}/submit`)
      .send({
        score: 20, // tentative de triche : ce champ doit être ignoré
        answers: [
          { questionId: 1, answerId: 1 }, // bonne réponse
          { questionId: 2, answerId: 4 }, // mauvaise réponse (la bonne est 3)
        ],
      })
      .expect(200);

    // 1 bonne réponse sur 2 → 10/20, et non le 20 envoyé par le client.
    expect(res.body).to.include({ quizId: IDS.publishedQuiz, score: 1, maxScore: 2, scoreOn20: 10 });
    // La correction de la question 2 indique la bonne réponse.
    expect(res.body.corrections[1]).to.include({ correct: false, correctAnswerId: 3 });
  });

  // On ne peut pas répondre, dans le quiz 1, à une question d'un autre quiz.
  it("refuse une question qui n'appartient pas au quiz", async () => {
    await request(app)
      .post(`/api/quizzes/${IDS.publishedQuiz}/submit`)
      .send({ answers: [{ questionId: 3, answerId: 5 }] }) // la question 3 est celle du brouillon
      .expect(400);
  });

  it('refuse de corriger un brouillon (404)', async () => {
    await request(app).post(`/api/quizzes/${IDS.draftQuiz}/submit`).send({ answers: [] }).expect(404);
  });

  // 415 Unsupported Media Type : l'API n'accepte que du JSON.
  it("répond 415 si le corps n'est pas du JSON", async () => {
    await request(app)
      .post(`/api/quizzes/${IDS.publishedQuiz}/submit`)
      .set('Content-Type', 'text/plain') // on force un autre format
      .send('bonjour') // send(chaîne) : envoyé tel quel, sans conversion en JSON
      .expect(415);
  });
});
