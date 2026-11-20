// =============================================================================
// tests/api/auth.api.test.js — Tests d'INTÉGRATION de l'authentification (E08)
// =============================================================================
//
// Un test d'INTÉGRATION vérifie que plusieurs éléments fonctionnent ENSEMBLE :
// routes, middlewares, contrôleurs, services et base de données.
// On ne teste plus une fonction isolée, mais une route de l'API, de la
// requête HTTP jusqu'à la réponse.
//
// Supertest envoie de vraies requêtes HTTP à l'application Express, sans
// démarrer de serveur sur un port. On lui passe directement l'objet « app » :
//
//   request(app)                          ← l'application à tester
//     .post('/api/auth/login')            ← méthode et URL
//     .set('Authorization', '…')          ← un en-tête (facultatif)
//     .send({ … })                        ← le corps, envoyé en JSON
//     .expect(200)                        ← le code de statut attendu
//
// Chaque appel renvoie une promesse : on l'attend avec await, et le test
// est donc une fonction async. Le résultat (res) donne accès à res.status,
// res.headers et res.body (le JSON déjà converti en objet).
//
// Rappel : la base est recréée avant chaque test (voir setup.js). Les
// utilisateurs trainer@test.local et student@test.local existent toujours.
// =============================================================================
const { expect } = require('chai');
const request = require('supertest');
const app = require('../../src/app'); // l'application Express, SANS app.listen()
const { PASSWORD, auth } = require('../helpers');

describe('POST /api/auth/login', () => {
  // Cas nominal : bons identifiants.
  it('renvoie un jeton et le profil, sans le mot de passe', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'trainer@test.local', password: PASSWORD }) // send(objet) → corps JSON
      .expect(200);

    // .expect() de Supertest vérifie le protocole HTTP (statut, en-têtes) ;
    // expect() de Chai vérifie le CONTENU de la réponse.
    expect(res.body.token).to.be.a('string');
    expect(res.body.user).to.include({ email: 'trainer@test.local', role: 'trainer' });

    // Test de SÉCURITÉ : le hachage du mot de passe ne doit jamais sortir de l'API.
    // Vérifier ce qui est ABSENT est aussi important que vérifier ce qui est présent.
    expect(res.body.user).to.not.have.property('passwordHash');
  });

  // L'e-mail ne doit pas dépendre de la casse : « Trainer@Test.local »
  // désigne le même compte que « trainer@test.local ».
  it("accepte l'e-mail en majuscules", async () => {
    // Ici, seul le statut nous intéresse : pas besoin de récupérer res.
    await request(app).post('/api/auth/login').send({ email: 'Trainer@Test.local', password: PASSWORD }).expect(200);
  });

  // 401 Unauthorized : identité non prouvée.
  it('répond 401 avec un mauvais mot de passe', async () => {
    await request(app).post('/api/auth/login').send({ email: 'trainer@test.local', password: 'faux' }).expect(401);
  });

  // 400 Bad Request : la requête est mal formée (validation).
  it('répond 400 si les champs manquent', async () => {
    await request(app).post('/api/auth/login').send({}).expect(400);
  });
});

describe('GET /api/auth/me', () => {
  it("renvoie l'utilisateur connecté", async () => {
    // auth.student : un en-tête « Bearer <jeton> » préparé dans helpers.js.
    const res = await request(app).get('/api/auth/me').set('Authorization', auth.student).expect(200);
    expect(res.body.role).to.equal('student');
  });

  // Un même test peut enchaîner plusieurs requêtes s'il vérifie UNE seule
  // règle : « sans jeton valide, pas d'accès ».
  it('répond 401 sans jeton ou avec un jeton invalide', async () => {
    await request(app).get('/api/auth/me').expect(401); // aucun en-tête Authorization
    await request(app).get('/api/auth/me').set('Authorization', 'Bearer faux.jeton.jwt').expect(401); // signature invalide
  });
});
