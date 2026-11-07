
function originGuard(allowedOrigins) {
  const allowAny = process.env.NODE_ENV !== 'production' && !allowedOrigins.length;

  return (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    const origin = req.get('Origin');

    if (!origin) return next();

    const vercelOrigin =
      /^https:\/\/club-des-amis-[a-z0-9-]+-hmranialaoui9-stacks-projects\.vercel\.app$/.test(origin);

    if (allowAny || allowedOrigins.includes(origin) || vercelOrigin) {
      return next();
    }

    return res.status(403).json({
      message: 'Origine non autorisée.',
    });
  };
}

module.exports = originGuard;
