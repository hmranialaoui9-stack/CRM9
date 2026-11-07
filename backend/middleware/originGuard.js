
const OFFICIAL_ORIGIN = 'https://club-des-amis.vercel.app';
const PROJECT_PREVIEW_ORIGIN = /^https:\/\/club-des-amis-(?:git-[a-z0-9]+(?:-[a-z0-9]+)*|[a-z0-9]{8,})-hmranialaoui9-stacks-projects\.vercel\.app$/;

function parseAllowedOrigins(value = process.env.CORS_ORIGIN || '') {
  return value.split(',').map((item) => item.trim()).filter(Boolean).map((item) => {
    try {
      const url = new URL(item);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
      return url.origin;
    } catch (_error) { return null; }
  }).filter(Boolean);
}

function isAllowedOrigin(origin, allowedOrigins = parseAllowedOrigins()) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin) || origin === OFFICIAL_ORIGIN || PROJECT_PREVIEW_ORIGIN.test(origin)) return true;
  return process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function originGuard(allowedOrigins = parseAllowedOrigins()) {

  return (req, res, next) => {
    if (['GET', 'HEAD'].includes(req.method)) {
      return next();
    }

    const origin = req.get('Origin');

    if (!origin) return next();
    if (isAllowedOrigin(origin, allowedOrigins)) {
      return next();
    }

    return res.status(403).json({
      message: 'Origine non autorisée.',
    });
  };
}

module.exports = originGuard;
module.exports.isAllowedOrigin = isAllowedOrigin;
module.exports.parseAllowedOrigins = parseAllowedOrigins;
