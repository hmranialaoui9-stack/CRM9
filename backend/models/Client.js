const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  nom: { type: String, required: [true, 'Le nom est obligatoire.'], trim: true, maxlength: 80 },
  prenom: { type: String, required: [true, 'Le prénom est obligatoire.'], trim: true, maxlength: 80 },
  email: { type: String, required: [true, "L'email est obligatoire."], unique: true, lowercase: true, trim: true, maxlength: 254 },
  telephone: { type: String, trim: true, maxlength: 30, default: '' },
  entreprise: { type: String, trim: true, maxlength: 120, default: '' },
  adresse: { type: String, trim: true, maxlength: 200, default: '' },
  ville: { type: String, trim: true, maxlength: 100, default: '' },
  statut: { type: String, enum: ['Prospect', 'Actif', 'Inactif'], default: 'Prospect' },
  notes: { type: String, trim: true, maxlength: 2000, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Client', clientSchema);
