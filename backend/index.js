
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('node:path');

const connectDB = require('./config/db');
const friendRoutes = require('./routes/friendRoutes');
const authRoutes = require('./routes/authRoutes');
const errorMiddleware = require('./middleware/errorMiddleware');
const { parseCookies, requireAuth } = require('./middleware/authMiddleware');
const originGuard = require('./middleware/originGuard');

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isDevelopment = process.env.NODE_ENV !== 'production';

const isAllowedOrigin = (origin) => {
  if (!origin) return true;

  if (allowedOrigins.includes(origin)) return true;

  if (
    /^https:\/\/club-des-amis-[a-z0-9-]+-hmranialaoui9-stacks-projects\.vercel\.app$/.test(origin)
  ) {
    return true;
  }

  if (
    isDevelopment &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  ) {
    return true;
  }

  return false;
};

if (!isDevelopment) {
  app.set('trust proxy', 1);
}

app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origine non autorisée par CORS.'));
  },
}));

app.use(express.json({ limit: '32kb' }));
app.use(parseCookies);

const publicDirectory = path.resolve(__dirname, '../public');

app.use(express.static(publicDirectory));

app.use('/api', originGuard(allowedOrigins));

app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    if (req.path === '/health') {
      return res.status(503).json({
        status: 'degraded',
        database: 'disconnected',
        message: 'API démarrée, MongoDB indisponible.',
      });
    }

    next(error);
  }
});

app.use('/api/auth', authRoutes);

app.get('/api/health', (_req, res) => {
  const connected = mongoose.connection.readyState === 1;

  res.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'degraded',
    database: connected ? 'connected' : 'disconnected',
    message: connected
      ? 'Club des Amis API fonctionne.'
      : 'API démarrée, MongoDB indisponible.',
  });
});

app.use('/api/friends', requireAuth, friendRoutes);

app.get('/', (_req, res) => {
  res.sendFile(path.join(publicDirectory, 'index.html'));
});

app.use((_req, res) => {
  res.status(404).json({ message: 'Route introuvable.' });
});

app.use(errorMiddleware);

module.exports = app;
