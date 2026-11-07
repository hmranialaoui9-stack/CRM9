const crypto = require('node:crypto');
const User = require('../models/User');

const AUTH_COOKIE = 'club_access';

function cookieOptions(maxAge, { oauthState = false } = {}) {
  const production = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: production,
    sameSite: oauthState ? 'lax' : (process.env.COOKIE_SAME_SITE || (production ? 'none' : 'lax')),
    path: '/',
    maxAge,
  };
}

function appendCookie(res, name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path || '/'}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite[0].toUpperCase()}${options.sameSite.slice(1)}`);
  res.append('Set-Cookie', parts.join('; '));
}

function clearCookie(res, name, options = {}) {
  appendCookie(res, name, '', { ...options, maxAge: 0 });
}

function parseCookies(req, _res, next) {
  req.cookies = {};
  for (const item of (req.headers.cookie || '').split(';')) {
    const separator = item.indexOf('=');
    if (separator < 1) continue;
    const name = item.slice(0, separator).trim();
    try { req.cookies[name] = decodeURIComponent(item.slice(separator + 1).trim()); }
    catch (_error) { req.cookies[name] = ''; }
  }
  next();
}

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error('JWT_SECRET doit contenir au moins 32 octets.');
  return secret;
}

function signToken(userId) {
  const secret = jwtSecret();
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: String(userId), iat: now, exp: now + 60 * 60 * 24, iss: 'club-des-amis' })).toString('base64url');
  const unsigned = `${header}.${payload}`;
  const signature = crypto.createHmac('sha256', secret).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}

function verifyToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  let header; let payload;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch (_error) { return null; }
  if (header.alg !== 'HS256' || payload.iss !== 'club-des-amis' || !payload.sub || !Number.isFinite(payload.exp) || payload.exp <= Date.now() / 1000) return null;
  let expected;
  try { expected = crypto.createHmac('sha256', jwtSecret()).update(`${parts[0]}.${parts[1]}`).digest(); }
  catch (_error) { return null; }
  let supplied;
  try { supplied = Buffer.from(parts[2], 'base64url'); }
  catch (_error) { return null; }
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null;
  return payload;
}

function publicUser(user) {
  const fullName = user.fullName || [user.prenom, user.nom].filter(Boolean).join(' ').trim();
  return {
    id: String(user._id), fullName, nom: user.nom, prenom: user.prenom,
    telephone: user.telephone || '', email: user.email, authProvider: user.authProvider,
  };
}

function issueAuthCookie(res, user) {
  appendCookie(res, AUTH_COOKIE, signToken(user._id), cookieOptions(24 * 60 * 60 * 1000));
}

async function requireAuth(req, res, next) {
  const payload = verifyToken(req.cookies?.[AUTH_COOKIE]);
  if (!payload) return res.status(401).json({ message: 'Connecte-toi pour accéder à cette page.' });
  try {
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ message: 'Cette session n’est plus valide.' });
    req.user = user;
    return next();
  } catch (error) { return next(error); }
}

module.exports = { AUTH_COOKIE, cookieOptions, appendCookie, clearCookie, parseCookies, signToken, verifyToken, publicUser, issueAuthCookie, requireAuth };
