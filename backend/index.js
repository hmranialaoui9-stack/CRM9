
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
const { isAllowedOrigin, parseAllowedOrigins } = originGuard;

const app = express();

const allowedOrigins = parseAllowedOrigins();

const isDevelopment = process.env.NODE_ENV !== 'production';

if (!isDevelopment) {
  app.set('trust proxy', 1);
}

app.use(cors({
  credentials: true,
  optionsSuccessStatus: 204,
  origin(origin, callback) {
    // Disallowed origins receive no CORS headers; originGuard returns 403 for
    // unsafe methods. Avoid surfacing expected CORS denials as server errors.
    return callback(null, isAllowedOrigin(origin, allowedOrigins));
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
