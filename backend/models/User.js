const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // fullName is canonical for new accounts; nom/prenom remain for existing CRM clients.
  fullName: { type: String, trim: true, minlength: 1, maxlength: 120 },
  nom: { type: String, trim: true, minlength: 1, maxlength: 80 },
  prenom: { type: String, trim: true, minlength: 1, maxlength: 80 },
  telephone: { type: String, trim: true, maxlength: 20, unique: true, sparse: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 254,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Une adresse email valide est nécessaire.'],
  },
  passwordHash: { type: String, select: false },
  googleId: { type: String, unique: true, sparse: true, select: false },
  authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
  passwordResetHash: { type: String, select: false },
  passwordResetExpiresAt: { type: Date, select: false },
  passwordResetAttempts: { type: Number, default: 0, select: false },
  passwordResetRequestedAt: { type: Date, select: false },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
