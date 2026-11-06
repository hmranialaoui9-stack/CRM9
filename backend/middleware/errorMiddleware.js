function errorMiddleware(error, _req, res, _next) {
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0];
    const message = field === 'telephone' ? 'Ce numéro de téléphone est déjà associé à un compte.' : 'Cette adresse Gmail est déjà associée à un compte.';
    return res.status(409).json({ message });
  }
  if (error.name === 'ValidationError') {
    return res.status(400).json({ message: Object.values(error.errors).map((item) => item.message).join(' ') });
  }
  if (error.name === 'CastError') {
    return res.status(400).json({ message: 'Identifiant ou donnée invalide.' });
  }
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ message: 'Le JSON envoyé est invalide.' });
  }

  const status = error.status || 500;
  if (status >= 500) console.error('Erreur API :', error);
  return res.status(status).json({ message: status < 500 ? error.message : 'Une erreur serveur est survenue.' });
}

module.exports = errorMiddleware;
