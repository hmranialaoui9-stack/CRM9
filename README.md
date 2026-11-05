# Pulse CRM

CRM full stack de gestion de clients, avec une API Express/Mongoose et une interface HTML, CSS et JavaScript sans framework.

## Prérequis

- Node.js 18 ou supérieur et npm
- MongoDB en local, ou une instance MongoDB Atlas

## Installation

1. Démarrez MongoDB localement (ou préparez une URI Atlas).
2. Dans un terminal, installez et démarrez l'API :

   ```bash
   cd CRM/backend
   npm install
   npm run dev
   ```

   Le backend lit `backend/.env`. Le fichier fourni utilise `mongodb://127.0.0.1:27017/crm` et le port `5000`. Pour une autre base, modifiez `MONGODB_URI`. `CORS_ORIGIN` est facultatif et permet de limiter les origines frontend (valeurs séparées par des virgules).

3. Servez `frontend/` avec un serveur de fichiers statiques. Par exemple, depuis le dossier `CRM` :

   ```bash
   npx --yes http-server frontend -p 5500
   ```

   Ouvrez l'adresse affichée (généralement `http://localhost:5500`). Un serveur HTTP est recommandé plutôt que l'ouverture directe du fichier. Le frontend utilise par défaut `http://localhost:5000/api`. Pour le déploiement, définissez `window.CRM_API_URL` avant le chargement de `index.js` afin de cibler l'URL de votre API. Aucun secret ne doit être placé dans le frontend.

## API

| Méthode | Route | Action |
| --- | --- | --- |
| GET | `/api/health` | État du serveur et de la base |
| GET | `/api/clients` | Liste des clients |
| GET | `/api/clients/:id` | Détail d'un client |
| POST | `/api/clients` | Création d'un client |
| PATCH | `/api/clients/:id` | Modification partielle |
| DELETE | `/api/clients/:id` | Suppression |

Les routes clients renvoient directement le client ou la liste des clients en JSON. Les erreurs renvoient un objet `{ message }` avec un statut HTTP explicite (validation, email en doublon, identifiant invalide ou client absent). L'endpoint de santé renvoie l'état du serveur et de la base.

## Fonctionnalités

- Ajout, consultation, modification et suppression des clients (confirmation avant suppression)
- Recherche instantanée, filtre par statut, statistiques actualisées et export CSV
- Validation des champs et notifications de succès ou d'erreur
- Champs : prénom, nom, email unique, téléphone, entreprise, adresse, ville, statut et notes
- Dates `createdAt` et `updatedAt` générées par Mongoose

Le modèle initialise une base vide ; aucun jeu de données n'est ajouté automatiquement. Créez vos clients depuis l'interface.

## Déploiement

Déployez le backend et le frontend comme deux services distincts. Définissez `NODE_ENV=production`, `PORT`, `MONGODB_URI` et `CORS_ORIGIN` côté backend. Restreignez CORS à l'origine publique du frontend et configurez `window.CRM_API_URL` côté frontend. Ne versionnez jamais `.env`.
