
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const clientRoutes = require('./routes/clientRoutes');

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((item) => item.trim())
    : true
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// 🩺 Vérification de l'état de l'API
app.get('/api/health', (_req, res) =>
  res.json({
    success: true,
    status: 'ok',
    database: require('mongoose').connection.readyState === 1
      ? 'connected'
      : 'disconnected'
  })
);

// 👥 Routes des clients
app.use('/api/clients', clientRoutes);

// ❌ Route introuvable
app.use((_req, res) =>
  res.status(404).json({
    success: false,
    message: '❌ Route introuvable.'
  })
);

// ⚠️ Gestion des erreurs
app.use((error, _req, res, _next) => {
  console.error('❌ Erreur serveur :', error);

  if (error.code === 11000)
    return res.status(409).json({
      success: false,
      message: '⚠️ Cette adresse email est déjà utilisée.'
    });

  if (error.name === 'ValidationError')
    return res.status(400).json({
      success: false,
      message: '⚠️ ' + Object.values(error.errors)
        .map((item) => item.message).join(' ')
    });

  if (error instanceof SyntaxError && error.status === 400 && 'body' in error)
    return res.status(400).json({
      success: false,
      message: '⚠️ Le JSON envoyé est invalide.'
    });

  res.status(error.status || 500).json({
    success: false,
    message: error.status
      ? error.message
      : '❌ Une erreur serveur est survenue.'
  });
});

// 🚀 Démarrage du serveur
const port = Number(process.env.PORT) || 4000;

connectDB()
  .then(() => app.listen(port, () =>
    console.info(`🚀 API CRM disponible sur http://localhost:${port}`)
  ))
  .catch((error) => {
    console.error('❌ Impossible de démarrer le serveur :', error.message);
    process.exit(1);
  });

module.exports = app;
