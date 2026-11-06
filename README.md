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

L'application demande une connexion pour accéder au tableau de bord et aux routes `friends`. Les comptes locaux acceptent un numéro de téléphone et une adresse `@gmail.com`. Les mots de passe sont hachés avec bcrypt (coût 12) ; l'API délivre un JWT signé dans un cookie `HttpOnly`, `SameSite` et `Secure` en production. Le frontend ne reçoit jamais le JWT. Les inscriptions et connexions sont limitées en fréquence. La récupération de mot de passe affiche une indication honnête : un service d'envoi et une procédure de réinitialisation doivent encore être configurés.

Les variables nécessaires sont listées dans `backend/.env.example`. Le fichier `backend/.env` existant n'a pas été remplacé. Ajoute les valeurs suivantes dans la configuration locale ou les variables Railway, en préservant les variables déjà présentes :

- `JWT_SECRET` : secret aléatoire d'au moins 32 octets ; génère-le avec `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`.
- `FRONTEND_URL` : origine du frontend, par exemple `http://localhost:5500`.
- `API_PUBLIC_URL` : origine publique du backend, par exemple `https://mon-api.up.railway.app`.
- `CORS_ORIGIN` : origine exacte du frontend autorisé (sans chemin), par exemple `http://localhost:5500`.
- `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` : identifiants OAuth du projet Google Cloud.
- `GOOGLE_CALLBACK_URL` : `http://localhost:4000/api/auth/google/callback` en local ; en production, l'URL publique de l'API suivie de `/api/auth/google/callback`.
- `COOKIE_SAME_SITE=none` lorsque Vercel et Railway utilisent des domaines distincts. En production `Secure` est automatiquement activé. Des domaines personnalisés sous le même domaine de site améliorent la compatibilité des cookies navigateur.

### Configurer Google OAuth

1. Dans Google Cloud Console, crée un projet, configure l'écran de consentement OAuth et ajoute les utilisateurs de test si l'application est en mode test.
2. Crée un identifiant OAuth de type **Application Web**. Ajoute `http://localhost:4000/api/auth/google/callback` aux URI de redirection autorisés en local, puis l'URL Railway `/api/auth/google/callback` en production.
3. Copie le Client ID et le Client Secret dans les variables d'environnement du backend. Ne mets jamais le secret dans Vercel ni dans les fichiers frontend.
4. Ajoute l'origine Vercel à `CORS_ORIGIN`, et renseigne `FRONTEND_URL` et `API_PUBLIC_URL`. Redéploie l'API puis le frontend.

Le bouton Google lance le flux OAuth Authorization Code réel avec validation du paramètre `state`, échange du code côté serveur, vérification de l'adresse Gmail confirmée par Google, puis création ou liaison du compte.

### Déploiement Vercel + Railway

- **Railway** : crée un service Node depuis `CRM/backend`, commande de démarrage `npm start`, ajoute `MONGODB_URI`, `JWT_SECRET`, `NODE_ENV=production`, `FRONTEND_URL`, `API_PUBLIC_URL`, `CORS_ORIGIN`, les variables Google et `COOKIE_SAME_SITE=none`. Ajoute le domaine Railway aux URI de redirection OAuth et autorise le serveur Railway dans les règles réseau de MongoDB Atlas.
- **Vercel** : déploie le dossier `CRM/frontend` comme site statique. Avant `js/app.js`, définis `window.CLUB_API_URL = 'https://<domaine-api-railway>/api';` dans `frontend/index.html` avec le domaine public Railway. Renseigne ensuite cette origine Vercel dans `CORS_ORIGIN` côté Railway.
- Vérifie `/api/health`, puis l'inscription, une connexion locale, la déconnexion et Google OAuth après avoir configuré de vrais identifiants. Les cookies tiers peuvent être bloqués si les domaines frontend/API sont différents ; privilégie des domaines personnalisés liés ou un proxy Vercel sous le même domaine.

## API d'authentification

Toutes les réponses sont JSON, sauf les routes de redirection OAuth.

| Méthode | Route | Accès | Description |
| --- | --- | --- | --- |
| POST | `/auth/register` | public | Inscription (`nom`, `prenom`, `telephone`, `email`, `password`, `confirmPassword`) |
| POST | `/auth/login` | public | Connexion (`identifier` téléphone ou Gmail, `password`) |
| POST | `/auth/logout` | public | Efface le cookie de session |
| GET | `/auth/me` | session requise | Retourne le profil connecté |
| GET | `/auth/google` | public | Démarre Google OAuth |
| GET | `/auth/google/callback` | OAuth | Vérifie le retour Google et ouvre une session |

Les routes REST `/friends` et `/friends/:id` nécessitent désormais le cookie de session. L'API conserve le modèle et les routes de gestion des amis.

## Déploiement Vercel (frontend et API séparés)

Le dépôt contient deux projets Vercel distincts, car les fichiers statiques du frontend et la fonction Express ont des racines de déploiement différentes. Le Runtime Log `Invalid export` est corrigé : `backend/index.js` exporte maintenant directement l'application Express ; seul `backend/dev.js`, appelé par `npm run dev`, ouvre le port local.

### API Express

1. Crée un projet Vercel depuis le dépôt et définis **Root Directory** sur `backend`.
2. Vercel détecte `index.js` comme application Express. `backend/vercel.json` règle la durée maximale d'exécution de cette fonction ; aucune route n'est déplacée et Express conserve `/api/health`, `/api/friends` et `/api/auth`.
3. Ajoute dans les variables **Production** de Vercel : `MONGODB_URI` (URI Atlas complète), `NODE_ENV=production`, `JWT_SECRET` (au moins 32 octets), `CORS_ORIGIN` (origine exacte du site frontend), `FRONTEND_URL` (URL du site frontend), `API_PUBLIC_URL` (URL du projet API), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` (`<API_PUBLIC_URL>/api/auth/google/callback`) et `COOKIE_SAME_SITE=none` si le frontend et l'API sont sur des origines différentes.
4. Dans MongoDB Atlas, vérifie que l'utilisateur de base a les droits nécessaires et que **Network Access** autorise les connexions sortantes de ton déploiement Vercel. La valeur réelle de `MONGODB_URI` n'est pas enregistrée dans le dépôt et n'a pas été inspectée.
5. Après déploiement, ouvre `<API_PUBLIC_URL>/api/health`. La réponse attendue comprend `status: "ok"` et `database: "connected"`.

### Frontend statique

1. Crée un second projet Vercel depuis le même dépôt et définis **Root Directory** sur `frontend`.
2. Configure `frontend/config.js` avec l'URL de l'API issue du premier déploiement, par exemple :

```js
window.CLUB_API_URL = 'https://club-des-amis-api.vercel.app/api';
```

3. Ajoute l'origine exacte du frontend à `CORS_ORIGIN` dans le projet API, puis redéploie l'API. Les appels utilisent `credentials: 'include'` pour les cookies HttpOnly.
4. Si Google OAuth est utilisé, enregistre `<API_PUBLIC_URL>/api/auth/google/callback` comme URI de redirection autorisée dans Google Cloud Console.

En local, `npm run dev` (ou `npm start`) depuis `backend` démarre toujours Express sur `PORT`/4000 via `dev.js`. `backend/index.js` et `backend/server.js` n'appellent jamais `app.listen()` ; Vercel les traite comme exports Express. Le listener local est dans `backend/dev.js`.
