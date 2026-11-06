// Démarrage local uniquement. Vercel importe index.js, qui n'ouvre aucun port.
require('dotenv').config();
const app = require('./index');

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.info(`Club des Amis API disponible sur http://localhost:${port}`);
});
