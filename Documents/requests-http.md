# Tester l'API avec un fichier `requests.http`

Un fichier `.http` contient des **requêtes HTTP écrites en texte**. Dans VS Code, l'extension **REST Client** les envoie au serveur et affiche les réponses. C'est une alternative à `curl` ou à Postman, versionnée avec le projet.

## Installer et utiliser

1. Installez l'extension **REST Client** (Huachao Mao, `humao.rest-client`) : panneau Extensions, Ctrl+Shift+X.
2. Démarrez le serveur : `npm run dev`.
3. Ouvrez `requests.http`. Au-dessus de chaque requête apparaît le lien **Send Request** : cliquez dessus, ou placez le curseur dans la requête et appuyez sur **Ctrl+Alt+R**.
4. La réponse (statut, en-têtes, corps) s'affiche dans un panneau à droite.

## Écrire une requête

```http
### Titre de la requête (et séparateur)
POST http://localhost:3000/api/quizzes/1/submit
Content-Type: application/json

{ "answers": [ { "questionId": 1, "answerId": 2 } ] }
```

| Élément | Règle |
|---|---|
| `###` | **sépare** deux requêtes ; le texte qui suit sert de titre |
| 1re ligne | `MÉTHODE URL` (`GET` si la méthode est omise) |
| lignes suivantes | les en-têtes, `Nom: valeur`, un par ligne |
| **ligne vide** | obligatoire avant le corps |
| corps | le JSON (ou le texte) envoyé ; pas de corps pour un `GET` ou un `DELETE` |
| `#` ou `//` | commentaire |

> ⚠️ Oublier la ligne vide est l'erreur la plus fréquente : le corps est alors pris pour un en-tête.

## Les variables

Déclarez une variable en haut du fichier, puis utilisez-la entre doubles accolades :

```http
@baseUrl = http://localhost:3000

###
GET {{baseUrl}}/api/quizzes
```

Changer de port ne demande alors qu'une seule modification.

## Réutiliser une réponse : les requêtes nommées

`# @name` donne un nom à une requête. Ses réponses deviennent accessibles aux requêtes suivantes :

```http
### Créer un quiz
# @name draft
POST {{baseUrl}}/api/quizzes
Content-Type: application/json

{ "title": "Mon quiz", "questions": [ ... ] }

### Publier CE quiz : son identifiant vient de la réponse précédente
PATCH {{baseUrl}}/api/quizzes/{{draft.response.body.id}}
Content-Type: application/json

{ "published": true }
```

C'est ainsi qu'on récupère un **jeton** après une connexion (E05) :

```http
@token = {{login.response.body.token}}

### Connexion
# @name login
POST {{baseUrl}}/api/auth/login
Content-Type: application/json

{ "email": "formateur@edutrack.local", "password": "Formateur123!" }

### Requête protégée
GET {{baseUrl}}/api/auth/me
Authorization: Bearer {{token}}
```

> 💡 Envoyez d'abord la requête nommée. Sinon, REST Client signale qu'elle « n'a pas encore été envoyée ».

## Envoyer un fichier (E04)

Pour un formulaire `multipart/form-data`, on écrit soi-même les parties, séparées par une **frontière** (*boundary*) annoncée dans `Content-Type`. `< chemin` insère le contenu d'un fichier :

```http
POST {{baseUrl}}/api/quizzes/import
Content-Type: multipart/form-data; boundary=EduTrackBoundary

--EduTrackBoundary
Content-Disposition: form-data; name="file"; filename="quiz-express.json"
Content-Type: application/json

< ./exemples/quiz-express.json
--EduTrackBoundary--
```

La dernière frontière se termine par `--`.

## Bonnes pratiques

- Une requête par cas à vérifier, avec un titre qui annonce le **résultat attendu** : `### Sans jeton → 401`.
- Regroupez les requêtes par thème, avec des lignes de commentaire (`######## IMPORT ########`).
- N'écrivez jamais un vrai mot de passe ni un vrai secret dans ce fichier : il est versionné.
- Pour enchaîner toutes les étapes automatiquement, utilisez plutôt le scénario `npm run scenario` (`scripts/scenario.js`).
