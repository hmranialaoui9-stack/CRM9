const buckets = new Map();

function rateLimit({ limit = 10, windowMs = 15 * 60 * 1000 } = {}) {
  return (req, res, next) => {
    const key = `${req.ip || req.socket.remoteAddress || 'unknown'}:${req.baseUrl}${req.path}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) bucket = { count: 0, resetAt: now + windowMs };
    bucket.count += 1;
    buckets.set(key, bucket);
    if (buckets.size > 5000) {
      for (const [bucketKey, value] of buckets) if (value.resetAt <= now) buckets.delete(bucketKey);
    }
    res.set('RateLimit-Limit', String(limit));
    res.set('RateLimit-Remaining', String(Math.max(0, limit - bucket.count)));
    if (bucket.count > limit) return res.status(429).json({ message: 'Trop de tentatives. Réessaie dans quelques minutes.' });
    return next();
  };
}

module.exports = rateLimit;
