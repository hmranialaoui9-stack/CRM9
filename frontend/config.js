// En production, remplacez cette valeur par l'URL de déploiement de l'API Vercel.
// Exemple : window.CLUB_API_URL = 'https://club-des-amis-api.vercel.app/api';
window.CLUB_API_URL = window.CLUB_API_URL || (
  ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? 'http://localhost:4000/api'
    : `${window.location.origin}/api`
);
