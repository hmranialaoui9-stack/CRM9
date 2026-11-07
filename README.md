# Club des Amis

Application web Full Stack pour gérer les membres du Club des Amis. Le frontend utilise HTML, CSS et JavaScript natifs ; le backend utilise Node.js, Express, Mongoose et MongoDB.

## Architecture

```text
CRM/
├── backend/
│   ├── config/db.js
│   ├── middleware/errorMiddleware.js
│   ├── models/Friend.js
│   ├── routes/friendRoutes.js
│   ├── .env                 # configuration locale, non versionnée
│   ├── .env.example
│   ├── index.js
│   └── package.json
└── frontend/
    ├── css/style.css
    ├── js/app.js
    └── index.html
```

Les routes et modèles CRM ont été retirés. La configuration MongoDB existante (`backend/.env`) est conservée telle quelle ; la nouvelle collection `friends` est séparée des anciennes collections MongoDB. Aucune donnée existante n'est migrée, modifiée ou supprimée.

## Prérequis et lancement

- Node.js 18+ et npm
- MongoDB local ou Atlas accessible via l'URI déjà configurée dans `backend/.env`

Terminal 1 :

```bash
cd CRM/backend
npm install
npm run dev
```

L'API démarre sur le port `4000` par défaut (ou `PORT` si défini). Elle expose l'état de MongoDB sur `/api/health`, même si la base n'est pas connectée.

Terminal 2 :

```bash
cd CRM
npx --yes http-server frontend -p 5500
```

Ouvre `http://localhost:5500`. L'URL API par défaut est `http://localhost:4000/api`. Pour la remplacer, définis `window.CLUB_API_URL` avant le chargement de `js/app.js`. Les identifiants de base ne doivent jamais être ajoutés au frontend.

Pour la configuration d'un autre environnement, copie `.env.example` vers `.env` uniquement si nécessaire, puis renseigne `MONGODB_URI`. Ne remplace pas un `.env` déjà configuré.

## Fonctionnalités

- Tableau de bord avec nombre de membres, nombre de villes, ville la plus représentée et derniers inscrits.
- Annuaire avec recherche instantanée, filtre par ville et pagination.
- Ajout, fiche détaillée, modification complète ou partielle et suppression confirmée.
- Validation des champs dans le navigateur et dans Mongoose, messages d'erreur et notifications toast.
- Statistiques et listes issues exclusivement de l'API ; aucun jeu de données fictif.

## API REST

Base URL locale : `http://localhost:4000/api`

| Méthode | Route | Résultat |
| --- | --- | --- |
| GET | `/health` | État API et MongoDB |
| GET | `/friends` | Liste JSON directe, triée par date d'inscription |
| GET | `/friends/:id` | Détail JSON d'un ami |
| POST | `/friends` | Création, HTTP 201 |
| PUT | `/friends/:id` | Remplacement complet des cinq champs modifiables |
| PATCH | `/friends/:id` | Modification partielle des champs fournis |
| DELETE | `/friends/:id` | Suppression confirmée côté frontend |

Les emails sont normalisés en minuscules. Un doublon renvoie HTTP 409 ; les validations renvoient HTTP 400 ; un identifiant mal formé renvoie HTTP 400 ; un ami absent renvoie HTTP 404. Les réponses de liste sont des tableaux JSON directs et les réponses de détail/création/modification sont des objets directs.

### Exemples JSON pour Postman

Créer un ami avec `POST /api/friends` :

```json
{
  "nom": "Alaoui",
  "prenom": "Hicham",
  "email": "hicham@example.com",
  "telephone": "0612345678",
  "ville": "Fès"
}
```

Remplacement complet avec `PUT /api/friends/:id` :

```json
{
  "nom": "Alaoui",
  "prenom": "Hicham",
  "email": "hicham@example.com",
  "telephone": "+212 6 12 34 56 78",
  "ville": "Fès"
}
```

Modification partielle avec `PATCH /api/friends/:id` :

```json
{
  "ville": "Casablanca"
}
```

## Modèle Friend

`nom`, `prenom`, `email`, `telephone` et `ville` sont obligatoires. `email` est unique ; `telephone` est conservé en `String` pour préserver les zéros initiaux et les indicatifs. Mongoose renseigne `createdAt` et `updatedAt` grâce à `timestamps: true`.

## Contrôles

Depuis le backend, les routes peuvent être vérifiées dans Postman avec les méthodes et URLs ci-dessus. Pour tester le parcours CRUD, crée un ami avec un email de test unique, récupère son identifiant dans la réponse, exécute `GET`, `PUT`, `PATCH`, puis `DELETE` sur cet identifiant. Vérifie séparément le cas de doublon avec une adresse déjà utilisée.

## Comptes, connexion et sécurité

L'application demande une connexion pour accéder au tableau de bord et aux routes `friends`. Les comptes locaux acceptent un numéro de téléphone et une adresse `@gmail.com`; le nom complet est stocké dans `fullName`, avec `nom` et `prenom` maintenus pour compatibilité avec les anciens comptes. Les mots de passe sont hachés avec bcrypt (coût 12) ; l'API délivre un JWT signé dans un cookie `HttpOnly`, `SameSite` et `Secure` en production. Le frontend ne reçoit jamais le JWT. Google OAuth vérifie l'identité et l'email via Google OpenID Connect. La récupération utilise un OTP à 6 chiffres, haché en base, expirant après 10 minutes et limité à cinq essais.

Les variables nécessaires sont listées dans `backend/.env.example`. Le fichier `backend/.env` existant n'a pas été remplacé. Ajoute les valeurs suivantes dans l'environnement backend, en préservant les variables déjà présentes :

- `JWT_SECRET` : secret aléatoire d'au moins 32 octets ; génère-le avec `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`.
- `FRONTEND_URL` : origine du frontend, par exemple `http://localhost:5500`.
- `API_PUBLIC_URL` : origine publique de l'API, par exemple `http://localhost:4000` ou le domaine Vercel en production.
- `CORS_ORIGIN` : une ou plusieurs origines séparées par des virgules, sans chemin. En production, configure `https://club-des-amis.vercel.app`; les previews Vercel de ce projet sont reconnues séparément.
- `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` : identifiants OAuth du projet Google Cloud.
- `GOOGLE_CALLBACK_URL` : `http://localhost:4000/api/auth/google/callback` en local ; en production, l'URL publique de l'API suivie de `/api/auth/google/callback`.
- `SMTP_USER` et `SMTP_PASS` : compte Gmail expéditeur et mot de passe d'application Google (pas le mot de passe normal du compte).
- `COOKIE_SAME_SITE=none` uniquement si frontend et API sont sur des domaines de site distincts. Avec le déploiement Vercel combiné décrit ci-dessous, le même domaine permet de garder la valeur par défaut `lax`.

### Configurer Google OAuth

1. Dans Google Cloud Console, crée un projet, configure l'écran de consentement OAuth et ajoute les utilisateurs de test si l'application est en mode test.
2. Crée un identifiant OAuth de type **Application Web**. Ajoute `http://localhost:4000/api/auth/google/callback` aux URI de redirection autorisés en local, puis `https://<domaine-vercel>/api/auth/google/callback` en production. Ajoute les origines locales et production aux origines JavaScript autorisées.
3. Configure `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` dans l'environnement backend (Variables Vercel pour ce déploiement intégré). Le secret reste côté serveur et ne doit jamais être ajouté au frontend ou au dépôt.
4. Renseigne `FRONTEND_URL` et `API_PUBLIC_URL` avec l'origine frontend/API, puis redéploie.

Le bouton Google lance le flux OAuth Authorization Code réel avec validation du paramètre `state`, échange du code côté serveur, vérification d'une adresse confirmée par Google, puis création ou liaison du compte.

### Déploiement Vercel

Le dépôt se déploie en un seul projet Vercel depuis sa racine. Configure les variables dans **Project Settings → Environment Variables**, puis redéploie : `MONGODB_URI`, `JWT_SECRET`, `NODE_ENV=production`, `FRONTEND_URL=https://club-des-amis.vercel.app`, `API_PUBLIC_URL=https://club-des-amis.vercel.app`, `CORS_ORIGIN=https://club-des-amis.vercel.app`, `SMTP_USER`, `SMTP_PASS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` et `GOOGLE_CALLBACK_URL=https://club-des-amis.vercel.app/api/auth/google/callback`. Ajoute aussi le domaine Vercel dans les URI de redirection Google et dans MongoDB Atlas **Network Access**. Ne définis pas `window.CLUB_API_URL` pour ce déploiement même origine. Les origines Preview sont filtrées par un motif strict `club-des-amis-…-hmranialaoui9-stacks-projects.vercel.app`.

Pour lancer localement, copie `backend/.env.example` vers `backend/.env`, renseigne les valeurs locales, puis lance `npm run dev` dans `backend`. Ouvre le frontend sur `http://localhost:5500`. Crée un mot de passe d'application Google pour `SMTP_PASS` et active OAuth dans Google Cloud. Après déploiement, contrôle `/api/health`, inscription, connexion, déconnexion, réinitialisation email et OAuth dans un navigateur.

## API d'authentification

Toutes les réponses sont JSON, sauf les routes de redirection OAuth.

| Méthode | Route | Accès | Description |
| --- | --- | --- | --- |
| POST | `/auth/register` | public | Inscription (`fullName`, `telephone`, `email`, `password`, `confirmPassword`; accepte aussi l'ancien couple `nom`/`prenom`) |
| POST | `/auth/login` | public | Connexion (`identifier` téléphone ou Gmail, `password`) |
| POST | `/auth/forgot-password` | public | Demande de code OTP (`email`); réponse générique |
| POST | `/auth/verify-otp` | public | Vérification (`email`, `code`), renvoie un jeton de réinitialisation à usage unique |
| POST | `/auth/reset-password` | public | Nouveau mot de passe (`email`, `resetToken`, `password`, `confirmPassword`) |
| POST | `/auth/logout` | public | Efface le cookie de session |
| GET | `/auth/me` | session requise | Retourne le profil connecté |
| GET | `/auth/google` | public | Démarre Google OAuth |
| GET | `/auth/google/callback` | OAuth | Vérifie le retour Google et ouvre une session |

### Essais Postman

Utilise `http://localhost:4000/api` en local, avec `Content-Type: application/json`. Le cookie `club_access` est HttpOnly : active la gestion des cookies Postman pour les requêtes `/auth/me` et `/friends`.

```http
POST /auth/register
{"fullName":"Hicham Alaoui","telephone":"0612345678","email":"hicham@gmail.com","password":"MotDePasse10!","confirmPassword":"MotDePasse10!"}

POST /auth/login
{"identifier":"hicham@gmail.com","password":"MotDePasse10!"}

POST /auth/forgot-password
{"email":"hicham@gmail.com"}

POST /auth/verify-otp
{"email":"hicham@gmail.com","code":"123456"}

POST /auth/reset-password
{"email":"hicham@gmail.com","resetToken":"JETON_RENVOYE_PAR_VERIFY","password":"NouveauPass10!","confirmPassword":"NouveauPass10!"}
```

Après `verify-otp`, récupère `resetToken` dans la réponse JSON pour l'étape finale. Teste Google dans un navigateur via `GET /auth/google` : l'aller-retour OAuth ne se teste pas avec un simple appel Postman.

Les routes REST `/friends` et `/friends/:id` nécessitent désormais le cookie de session. L'API conserve le modèle et les routes de gestion des amis.

## Déploiement Vercel (frontend et API sur la même origine)

Le dépôt se déploie comme un seul projet Vercel depuis sa racine (`CRM`). Le fichier racine `vercel.json` lance `npm ci --prefix backend`, puis `npm --prefix backend run build` : le script `backend/build-public.js` copie les fichiers du frontend dans `public/`, que Vercel sert comme fichiers statiques à la racine. Vercel détecte automatiquement l'application Express exportée par `backend/index.js` ; aucune surcharge `functions`/`includeFiles` n'est définie, les fichiers publics étant servis comme contenu statique. `backend/dev.js` reste le seul point d'entrée local qui appelle `app.listen()`.

Ainsi, `/` sert `public/index.html`, tandis que `/api/health`, `/api/friends` et `/api/auth/...` sont traités par Express. Le frontend utilise `/api` sur le domaine Vercel et `http://localhost:4000/api` en local.

### Paramètres du projet Vercel

- **Root Directory** : racine du dépôt (`CRM`), et non `backend` ou `frontend`. L’erreur `backend/backend/package.json` indique que le projet Vercel est actuellement enraciné dans `backend` alors que sa commande ajoute déjà ce préfixe.
- **Install Command** : défini dans `vercel.json` (`npm ci --prefix backend`), qui utilise `CRM/backend/package-lock.json` sans chercher un package imbriqué.
- **Build Command** : défini dans `vercel.json` (`npm --prefix backend run build`).
- **Output Directory** : laisser le réglage par défaut ; le dossier `public/` est publié par Vercel.
- Variables Production : `MONGODB_URI` (URI Atlas), `NODE_ENV=production`, `JWT_SECRET` (au moins 32 octets), `CORS_ORIGIN=https://club-des-amis.vercel.app`, `FRONTEND_URL` et `API_PUBLIC_URL` (à `https://club-des-amis.vercel.app`), `SMTP_USER`, `SMTP_PASS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` et `GOOGLE_CALLBACK_URL=https://club-des-amis.vercel.app/api/auth/google/callback`.
- Dans MongoDB Atlas, vérifie les droits de l'utilisateur DB et **Network Access** pour les connexions du déploiement Vercel. La valeur privée de `MONGODB_URI` n'a pas été lue ni modifiée.

Après le déploiement, vérifie `https://<domaine-vercel>/`, `https://<domaine-vercel>/api/health` et, après connexion, `https://<domaine-vercel>/api/friends`. Le statut health doit contenir `status: "ok"` et `database: "connected"` quand Atlas est joignable.

En local, `npm run dev` ou `npm start` depuis `backend` construit les fichiers publics puis lance Express sur `PORT` ou 4000. Les routes de gestion des amis restent protégées par la session : connecte-toi avant les opérations CRUD. Les méthodes disponibles sont GET, POST, PUT, PATCH et DELETE.
