
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const friendRoutes = require('./routes/friendRoutes');
const authRoutes = require('./routes/authRoutes');
const errorMiddleware = require('./middleware/errorMiddleware');
const { parseCookies, requireAuth } = require('./middleware/authMiddleware');
const originGuard = require('./middleware/originGuard');

const app = express();
const allowedOrigins = process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean);
const isDevelopment = process.env.NODE_ENV !== 'production';

if (!isDevelopment) app.set('trust proxy', 1);

app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const localOrigin = isDevelopment && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (localOrigin || allowedOrigins?.includes(origin)) return callback(null, true);
    const error = new Error('Origine non autorisée par CORS.'); error.status = 403;
    return callback(error);
  },
}));
app.use(express.json({ limit: '32kb' }));
app.use(parseCookies);
app.use('/api', originGuard(allowedOrigins || []));
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    return next();
  } catch (error) {
    if (req.path === '/health') {
      return res.status(503).json({
        status: 'degraded',
        database: 'disconnected',
        message: 'API démarrée, MongoDB indisponible.',
      });
    }
    return next(error);
  }
});
app.use('/api/auth', authRoutes);

app.get('/api/health', (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  return res.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'degraded',
    database: connected ? 'connected' : 'disconnected',
    message: connected ? 'Club des Amis API fonctionne.' : 'API démarrée, MongoDB indisponible.',
  });
});

app.use('/api/friends', requireAuth, friendRoutes);

app.use((_req, res) => res.status(404).json({ message: 'Route introuvable.' }));
app.use(errorMiddleware);

// Vercel détecte l'application Express comme handler serverless via cet export.
// Le listener local est séparé dans dev.js.
module.exports = app;
