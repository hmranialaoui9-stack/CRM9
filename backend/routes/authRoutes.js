const express = require('express');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const rateLimit = require('../middleware/rateLimit');
const { cookieOptions, appendCookie, clearCookie, publicUser, issueAuthCookie, requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const emailPattern = /^[a-z0-9._%+-]+@gmail\.com$/i;
const googleStateCookie = 'club_google_state';
const authLimiter = rateLimit({ limit: 8 });
const googleLimiter = rateLimit({ limit: 12 });

function normalizePhone(value) { return String(value || '').trim().replace(/[\s().-]/g, ''); }
function passwordIssue(password) {
  if (typeof password !== 'string' || password.length < 10) return 'Le mot de passe doit contenir au moins 10 caractères.';
  if (Buffer.byteLength(password, 'utf8') > 72) return 'Le mot de passe ne peut pas dépasser 72 octets.';
  return null;
}
function frontendRedirect(fragment) {
  const base = (process.env.FRONTEND_URL || 'http://localhost:5500').replace(/\/+$/, '');
  return `${base}/#${fragment}`;
}
function googleSettings() {
  const port = Number(process.env.PORT) || 4000;
  const apiBase = (process.env.API_PUBLIC_URL || `http://localhost:${port}`).replace(/\/+$/, '');
  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || `${apiBase}/api/auth/google/callback`,
  };
}
function googleConfigured() {
  const { clientId, clientSecret } = googleSettings();
  return Boolean(clientId && clientSecret);
}
function validState(cookieValue, queryValue) {
  if (typeof cookieValue !== 'string' || typeof queryValue !== 'string') return false;
  const left = Buffer.from(cookieValue); const right = Buffer.from(queryValue);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

router.post('/register', authLimiter, asyncRoute(async (req, res) => {
  const { nom, prenom, email, telephone, password, confirmPassword } = req.body || {};
  if ([nom, prenom, email, telephone, password].some((value) => typeof value !== 'string')) {
    return res.status(400).json({ message: 'Tous les champs sont obligatoires.' });
  }
  const cleanNom = nom.trim(); const cleanPrenom = prenom.trim(); const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = normalizePhone(telephone);
  if (!cleanNom || cleanNom.length > 80 || !cleanPrenom || cleanPrenom.length > 80) return res.status(400).json({ message: 'Vérifie le nom et le prénom (80 caractères maximum).'});
  if (!emailPattern.test(cleanEmail)) return res.status(400).json({ message: 'Utilise une adresse Gmail valide.' });
  if (!/^\+?\d{8,15}$/.test(cleanPhone)) return res.status(400).json({ message: 'Saisis un numéro de téléphone valide (8 à 15 chiffres, indicatif facultatif).'});
  const issue = passwordIssue(password);
  if (issue) return res.status(400).json({ message: issue });
  if (password !== confirmPassword) return res.status(400).json({ message: 'Les mots de passe ne correspondent pas.' });

  const duplicate = await User.findOne({ $or: [{ email: cleanEmail }, { telephone: cleanPhone }] }).select('email telephone');
  if (duplicate?.email === cleanEmail) return res.status(409).json({ message: 'Un compte utilise déjà cette adresse Gmail.' });
  if (duplicate?.telephone === cleanPhone) return res.status(409).json({ message: 'Un compte utilise déjà ce numéro de téléphone.' });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ nom: cleanNom, prenom: cleanPrenom, email: cleanEmail, telephone: cleanPhone, passwordHash, authProvider: 'local' });
  issueAuthCookie(res, user);
  return res.status(201).json({ message: 'Ton compte Club des Amis est prêt.', user: publicUser(user) });
}));

router.post('/login', authLimiter, asyncRoute(async (req, res) => {
  const identifier = typeof req.body?.identifier === 'string' ? req.body.identifier.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!identifier || !password) return res.status(400).json({ message: 'Saisis ton numéro de téléphone ou ton Gmail et ton mot de passe.' });
  const normalized = identifier.includes('@') ? identifier.toLowerCase() : normalizePhone(identifier);
  const query = identifier.includes('@' ) ? { email: normalized } : { telephone: normalized };
  const user = await User.findOne(query).select('+passwordHash');
  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect.' });
  }
  issueAuthCookie(res, user);
  return res.status(200).json({ message: 'Content de te revoir !', user: publicUser(user) });
}));

router.post('/logout', (req, res) => {
  clearCookie(res, 'club_access', cookieOptions(0));
  return res.status(200).json({ message: 'Tu es déconnecté.' });
});

router.get('/me', requireAuth, asyncRoute(async (req, res) => {
  return res.status(200).json({ user: publicUser(req.user) });
}));

router.get('/google', googleLimiter, (req, res) => {
  if (!googleConfigured()) return res.redirect(frontendRedirect('auth?error=google_unconfigured'));
  const state = crypto.randomBytes(32).toString('base64url');
  appendCookie(res, googleStateCookie, state, cookieOptions(10 * 60 * 1000, { oauthState: true }));
  const { clientId, callbackUrl } = googleSettings();
  const target = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  target.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  }).toString();
  return res.redirect(target.toString());
});

router.get('/google/callback', asyncRoute(async (req, res) => {
  const state = req.query.state;
  const savedState = req.cookies?.[googleStateCookie];
  clearCookie(res, googleStateCookie, cookieOptions(0, { oauthState: true }));
  if (req.query.error || !validState(savedState, state) || typeof req.query.code !== 'string') {
    return res.redirect(frontendRedirect(`auth?error=${req.query.error ? 'google_cancelled' : 'google_state_invalid'}`));
  }
  if (!googleConfigured()) return res.redirect(frontendRedirect('auth?error=google_unconfigured'));

  const settings = googleSettings();
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      code: req.query.code,
      client_id: settings.clientId,
      client_secret: settings.clientSecret,
      redirect_uri: settings.callbackUrl,
      grant_type: 'authorization_code',
    }),
  });
  const tokenPayload = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenPayload.access_token) return res.redirect(frontendRedirect('auth?error=google_exchange_failed'));

  const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokenPayload.access_token}`, Accept: 'application/json' },
  });
  const profile = await profileResponse.json().catch(() => ({}));
  const email = typeof profile.email === 'string' ? profile.email.trim().toLowerCase() : '';
  if (!profileResponse.ok || !profile.sub || profile.email_verified !== true || !emailPattern.test(email)) {
    return res.redirect(frontendRedirect('auth?error=google_email_unverified'));
  }

  const existingGoogleUser = await User.findOne({ googleId: String(profile.sub) });
  const existingEmailUser = await User.findOne({ email });
  if (existingGoogleUser && existingGoogleUser.email !== email) {
    existingGoogleUser.email = email;
    await existingGoogleUser.save();
  }
  if (existingEmailUser?.googleId && existingEmailUser.googleId !== String(profile.sub)) {
    return res.redirect(frontendRedirect('auth?error=google_account_conflict'));
  }
  let user = existingGoogleUser || existingEmailUser;
  if (user) {
    user.googleId = String(profile.sub);
    user.authProvider = 'google';
    if (profile.given_name) user.prenom = String(profile.given_name).slice(0, 80);
    if (profile.family_name) user.nom = String(profile.family_name).slice(0, 80);
    await user.save();
  } else {
    const displayName = String(profile.name || '').trim().split(/\s+/);
    user = await User.create({
      prenom: String(profile.given_name || displayName[0] || 'Ami').slice(0, 80),
      nom: String(profile.family_name || displayName.slice(1).join(' ') || 'du Club').slice(0, 80),
      email,
      googleId: String(profile.sub),
      authProvider: 'google',
    });
  }
  issueAuthCookie(res, user);
  return res.redirect(frontendRedirect('dashboard'));
}));

module.exports = router;
