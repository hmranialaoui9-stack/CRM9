const express = require('express');
const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const rateLimit = require('../middleware/rateLimit');
const { cookieOptions, appendCookie, clearCookie, publicUser, issueAuthCookie, requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const emailPattern = /^[a-z0-9._%+-]+@gmail\.com$/i;
const generalEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const googleStateCookie = 'club_google_state';
const authLimiter = rateLimit({ limit: 8 });
const resetRequestLimiter = rateLimit({ limit: 4, windowMs: 60 * 60 * 1000 });
const otpLimiter = rateLimit({ limit: 8 });
const googleLimiter = rateLimit({ limit: 12 });
const GENERIC_RESET = 'Si cette adresse correspond à un compte, un code de vérification sera envoyé.';

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
  return { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || `${apiBase}/api/auth/google/callback` };
}
function googleConfigured() { const { clientId, clientSecret } = googleSettings(); return Boolean(clientId && clientSecret); }
function validState(cookieValue, queryValue) {
  if (typeof cookieValue !== 'string' || typeof queryValue !== 'string') return false;
  const left = Buffer.from(cookieValue); const right = Buffer.from(queryValue);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
function displayName(user) { return user.fullName || [user.prenom, user.nom].filter(Boolean).join(' ').trim(); }
function resetDigest(code) { return crypto.createHash('sha256').update(code).digest('hex'); }
function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'hex'); const right = Buffer.from(String(b || ''), 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

router.post('/register', authLimiter, asyncRoute(async (req, res) => {
  const { email, telephone, password, confirmPassword } = req.body || {};
  // Keep accepting old clients sending nom/prenom while storing a canonical fullName.
  const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim()
    : [req.body?.prenom, req.body?.nom].filter((part) => typeof part === 'string').map((part) => part.trim()).filter(Boolean).join(' ');
  if ([fullName, email, telephone, password].some((value) => typeof value !== 'string')) return res.status(400).json({ message: 'Tous les champs sont obligatoires.' });
  const cleanEmail = email.trim().toLowerCase(); const cleanPhone = normalizePhone(telephone);
  if (!fullName || fullName.length > 120) return res.status(400).json({ message: 'Saisis ton nom complet (120 caractères maximum).' });
  if (!emailPattern.test(cleanEmail)) return res.status(400).json({ message: 'Utilise une adresse Gmail valide.' });
  if (!/^\+?\d{8,15}$/.test(cleanPhone)) return res.status(400).json({ message: 'Saisis un numéro de téléphone valide (8 à 15 chiffres, indicatif facultatif).' });
  const issue = passwordIssue(password); if (issue) return res.status(400).json({ message: issue });
  if (password !== confirmPassword) return res.status(400).json({ message: 'Les mots de passe ne correspondent pas.' });
  const duplicate = await User.findOne({ $or: [{ email: cleanEmail }, { telephone: cleanPhone }] }).select('email telephone');
  if (duplicate?.email === cleanEmail) return res.status(409).json({ message: 'Un compte utilise déjà cette adresse Gmail.' });
  if (duplicate?.telephone === cleanPhone) return res.status(409).json({ message: 'Un compte utilise déjà ce numéro de téléphone.' });
  const passwordHash = await bcrypt.hash(password, 12);
  const pieces = fullName.split(/\s+/);
  const user = await User.create({ fullName, prenom: pieces[0], nom: pieces.slice(1).join(' ') || pieces[0], email: cleanEmail, telephone: cleanPhone, passwordHash, authProvider: 'local' });
  issueAuthCookie(res, user);
  return res.status(201).json({ message: 'Ton compte Club des Amis est prêt.', user: publicUser(user) });
}));

router.post('/login', authLimiter, asyncRoute(async (req, res) => {
  const identifier = typeof req.body?.identifier === 'string' ? req.body.identifier.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!identifier || !password) return res.status(400).json({ message: 'Saisis ton numéro de téléphone ou ton Gmail et ton mot de passe.' });
  const query = identifier.includes('@') ? { email: identifier.toLowerCase() } : { telephone: normalizePhone(identifier) };
  const user = await User.findOne(query).select('+passwordHash');
  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect.' });
  issueAuthCookie(res, user);
  return res.status(200).json({ message: 'Content de te revoir !', user: publicUser(user) });
}));

router.post('/forgot-password', resetRequestLimiter, asyncRoute(async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!generalEmailPattern.test(email)) return res.status(200).json({ message: GENERIC_RESET });
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return res.status(503).json({ message: 'Le service de récupération est temporairement indisponible.' });
  const user = await User.findOne({ email }).select('+passwordResetRequestedAt');
  if (!user || !user.passwordHash) return res.status(200).json({ message: GENERIC_RESET });
  const now = Date.now();
  if (user.passwordResetRequestedAt && now - user.passwordResetRequestedAt.getTime() < 60_000) return res.status(200).json({ message: GENERIC_RESET });
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  user.passwordResetHash = resetDigest(code); user.passwordResetExpiresAt = new Date(now + 10 * 60_000);
  user.passwordResetAttempts = 0; user.passwordResetRequestedAt = new Date(now); await user.save();
  try {
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
    await transporter.sendMail({ from: `Club des Amis <${process.env.SMTP_USER}>`, to: email,
      subject: 'Votre code de réinitialisation — Club des Amis',
      text: `Votre code est ${code}. Il expire dans 10 minutes. Si vous n'avez pas demandé cette réinitialisation, ignorez ce message.`,
      html: `<p>Votre code de vérification est <strong style="font-size:24px;letter-spacing:5px">${code}</strong>.</p><p>Il expire dans 10 minutes. Si vous n'avez pas demandé cette réinitialisation, ignorez ce message.</p>` });
  } catch (error) {
    user.passwordResetHash = undefined; user.passwordResetExpiresAt = undefined; await user.save();
    console.error('Échec de livraison OTP SMTP :', error.message);
    return res.status(200).json({ message: GENERIC_RESET });
  }
  return res.status(200).json({ message: GENERIC_RESET });
}));

router.post('/verify-otp', otpLimiter, asyncRoute(async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  const user = generalEmailPattern.test(email) ? await User.findOne({ email }).select('+passwordResetHash +passwordResetExpiresAt +passwordResetAttempts') : null;
  if (!user?.passwordResetHash || !user.passwordResetExpiresAt || user.passwordResetExpiresAt <= new Date() || user.passwordResetAttempts >= 5) return res.status(400).json({ message: 'Code invalide ou expiré. Demande un nouveau code.' });
  if (!/^\d{6}$/.test(code) || !safeEqual(user.passwordResetHash, resetDigest(code))) {
    user.passwordResetAttempts += 1;
    if (user.passwordResetAttempts >= 5) { user.passwordResetHash = undefined; user.passwordResetExpiresAt = undefined; }
    await user.save(); return res.status(400).json({ message: 'Code invalide ou expiré. Demande un nouveau code.' });
  }
  const resetToken = crypto.randomBytes(32).toString('base64url');
  const consumed = await User.findOneAndUpdate({ _id: user._id, passwordResetHash: user.passwordResetHash, passwordResetExpiresAt: { $gt: new Date() }, passwordResetAttempts: { $lt: 5 } }, {
    $set: { passwordResetHash: resetDigest(resetToken), passwordResetExpiresAt: new Date(Date.now() + 10 * 60_000), passwordResetAttempts: 0 },
  }, { new: true });
  if (!consumed) return res.status(400).json({ message: 'Code invalide ou expiré. Demande un nouveau code.' });
  return res.status(200).json({ message: 'Code vérifié.', resetToken });
}));

router.post('/reset-password', authLimiter, asyncRoute(async (req, res) => {
  const { email, resetToken, password, confirmPassword } = req.body || {};
  if (typeof email !== 'string' || typeof resetToken !== 'string' || !resetToken || typeof password !== 'string') return res.status(400).json({ message: 'Demande de réinitialisation invalide.' });
  const issue = passwordIssue(password); if (issue) return res.status(400).json({ message: issue });
  if (password !== confirmPassword) return res.status(400).json({ message: 'Les mots de passe ne correspondent pas.' });
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordResetHash +passwordResetExpiresAt');
  if (!user?.passwordResetHash || !user.passwordResetExpiresAt || user.passwordResetExpiresAt <= new Date() || !safeEqual(user.passwordResetHash, resetDigest(resetToken))) return res.status(400).json({ message: 'Demande invalide ou expirée. Recommence la vérification.' });
  const passwordHash = await bcrypt.hash(password, 12);
  const updated = await User.findOneAndUpdate({ _id: user._id, passwordResetHash: resetDigest(resetToken), passwordResetExpiresAt: { $gt: new Date() } }, {
    $set: { passwordHash },
    $unset: { passwordResetHash: 1, passwordResetExpiresAt: 1, passwordResetRequestedAt: 1 },
  });
  if (!updated) return res.status(400).json({ message: 'Demande invalide ou expirée. Recommence la vérification.' });
  return res.status(200).json({ message: 'Mot de passe modifié. Tu peux maintenant te connecter.' });
}));

router.post('/logout', (_req, res) => { clearCookie(res, 'club_access', cookieOptions(0)); return res.status(200).json({ message: 'Tu es déconnecté.' }); });
router.get('/me', requireAuth, asyncRoute(async (req, res) => res.status(200).json({ user: publicUser(req.user) })));

router.get('/google', googleLimiter, (req, res) => {
  if (!googleConfigured()) return res.redirect(frontendRedirect('auth?error=google_unconfigured'));
  const state = crypto.randomBytes(32).toString('base64url');
  appendCookie(res, googleStateCookie, state, cookieOptions(10 * 60 * 1000, { oauthState: true }));
  const { clientId, callbackUrl } = googleSettings(); const target = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  target.search = new URLSearchParams({ client_id: clientId, redirect_uri: callbackUrl, response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' }).toString();
  return res.redirect(target.toString());
});

router.get('/google/callback', asyncRoute(async (req, res) => {
  const savedState = req.cookies?.[googleStateCookie]; clearCookie(res, googleStateCookie, cookieOptions(0, { oauthState: true }));
  if (req.query.error || !validState(savedState, req.query.state) || typeof req.query.code !== 'string') return res.redirect(frontendRedirect(`auth?error=${req.query.error ? 'google_cancelled' : 'google_state_invalid'}`));
  if (!googleConfigured()) return res.redirect(frontendRedirect('auth?error=google_unconfigured'));
  const settings = googleSettings();
  let tokenResponse;
  try {
    tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams({ code: req.query.code, client_id: settings.clientId, client_secret: settings.clientSecret, redirect_uri: settings.callbackUrl, grant_type: 'authorization_code' }) });
  } catch (_error) { return res.redirect(frontendRedirect('auth?error=google_exchange_failed')); }
  const tokenPayload = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenPayload.access_token) return res.redirect(frontendRedirect('auth?error=google_exchange_failed'));
  const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tokenPayload.access_token}`, Accept: 'application/json' } });
  const profile = await profileResponse.json().catch(() => ({})); const email = typeof profile.email === 'string' ? profile.email.trim().toLowerCase() : '';
  if (!profileResponse.ok || !profile.sub || profile.email_verified !== true || !generalEmailPattern.test(email)) return res.redirect(frontendRedirect('auth?error=google_email_unverified'));
  const googleId = String(profile.sub); let user = await User.findOne({ googleId });
  const emailUser = await User.findOne({ email });
  if (user && user.email !== email) return res.redirect(frontendRedirect('auth?error=google_account_conflict'));
  if (emailUser?.googleId && emailUser.googleId !== googleId) return res.redirect(frontendRedirect('auth?error=google_account_conflict'));
  user = user || emailUser;
  const name = String(profile.name || [profile.given_name, profile.family_name].filter(Boolean).join(' ') || 'Ami du Club').trim().slice(0, 120);
  if (user) {
    user.googleId = googleId; user.authProvider = 'google'; user.fullName = user.fullName || displayName(user) || name;
    user.prenom = user.prenom || String(profile.given_name || name.split(/\s+/)[0]).slice(0, 80);
    user.nom = user.nom || String(profile.family_name || name.split(/\s+/).slice(1).join(' ') || user.prenom).slice(0, 80);
  } else {
    const parts = name.split(/\s+/);
    user = new User({ fullName: name, prenom: String(profile.given_name || parts[0]).slice(0, 80), nom: String(profile.family_name || parts.slice(1).join(' ') || parts[0]).slice(0, 80), email, googleId, authProvider: 'google' });
  }
  await user.save(); issueAuthCookie(res, user); return res.redirect(frontendRedirect('dashboard'));
}));

module.exports = router;
