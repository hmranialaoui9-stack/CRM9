const mongoose = require('mongoose');

const friendSchema = new mongoose.Schema({
  nom: { type: String, required: [true, 'Le nom est obligatoire.'], trim: true, minlength: 1, maxlength: 80 },
  prenom: { type: String, required: [true, 'Le prénom est obligatoire.'], trim: true, minlength: 1, maxlength: 80 },
  email: {
    type: String,
    required: [true, "L'adresse email est obligatoire."],
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 254,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Adresse email invalide.'],
  },
  telephone: {
    type: String,
    required: [true, 'Le téléphone est obligatoire.'],
    trim: true,
    maxlength: 30,
    match: [/^\+?[\d\s().-]{6,30}$/, 'Numéro de téléphone invalide.'],
  },
  ville: { type: String, required: [true, 'La ville est obligatoire.'], trim: true, minlength: 1, maxlength: 100 },
}, { timestamps: true });

module.exports = mongoose.model('Friend', friendSchema);
