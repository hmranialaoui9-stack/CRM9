function originGuard(allowedOrigins) {
  const allowAny = process.env.NODE_ENV !== 'production' && !allowedOrigins.length;
  return (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('Origin');
    if (!origin) return next(); // Postman et appels serveur-à-serveur.
    if (allowAny || allowedOrigins.includes(origin)) return next();
    return res.status(403).json({ message: 'Origine non autorisée.' });
  };
}

module.exports = originGuard;
