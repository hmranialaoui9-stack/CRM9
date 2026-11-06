const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  nom: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
  prenom: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
  telephone: { type: String, trim: true, maxlength: 20, unique: true, sparse: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 254,
    match: [/^[a-z0-9._%+-]+@gmail\.com$/i, 'Une adresse Gmail valide est nécessaire.'],
  },
  passwordHash: { type: String, select: false },
  googleId: { type: String, unique: true, sparse: true, select: false },
  authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
