const express = require('express');
const mongoose = require('mongoose');
const Friend = require('../models/Friend');

const router = express.Router();
const FIELDS = ['nom', 'prenom', 'email', 'telephone', 'ville'];
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function pickFields(body, { requireAll = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    const error = new Error('Le corps de la requête doit être un objet JSON.');
    error.status = 400;
    throw error;
  }
  const unknown = Object.keys(body).filter((key) => !FIELDS.includes(key));
  if (unknown.length) {
    const error = new Error(`Champ(s) non autorisé(s) : ${unknown.join(', ')}.`);
    error.status = 400;
    throw error;
  }
  const nonStrings = FIELDS.filter((key) => Object.hasOwn(body, key) && typeof body[key] !== 'string');
  if (nonStrings.length) {
    const error = new Error(`Les champs suivants doivent être des chaînes de caractères : ${nonStrings.join(', ')}.`);
    error.status = 400;
    throw error;
  }
  if (requireAll) {
    const missing = FIELDS.filter((key) => !Object.hasOwn(body, key));
    if (missing.length) {
      const error = new Error(`Champs obligatoires manquants : ${missing.join(', ')}.`);
      error.status = 400;
      throw error;
    }
  }
  return Object.fromEntries(FIELDS.filter((key) => Object.hasOwn(body, key)).map((key) => [key, body[key]]));
}

function checkId(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.status(400).json({ message: 'Identifiant MongoDB invalide.' });
  return next();
}

router.get('/', asyncRoute(async (_req, res) => {
  const friends = await Friend.find().sort({ createdAt: -1 });
  return res.status(200).json(friends);
}));

router.get('/:id', checkId, asyncRoute(async (req, res) => {
  const friend = await Friend.findById(req.params.id);
  if (!friend) return res.status(404).json({ message: 'Ami introuvable.' });
  return res.status(200).json(friend);
}));

router.post('/', asyncRoute(async (req, res) => {
  const friend = await Friend.create(pickFields(req.body, { requireAll: true }));
  return res.status(201).json(friend);
}));

router.put('/:id', checkId, asyncRoute(async (req, res) => {
  const values = pickFields(req.body, { requireAll: true });
  const friend = await Friend.findById(req.params.id);
  if (!friend) return res.status(404).json({ message: 'Ami introuvable.' });
  Object.assign(friend, values);
  await friend.save();
  return res.status(200).json(friend);
}));

router.patch('/:id', checkId, asyncRoute(async (req, res) => {
  const values = pickFields(req.body);
  if (!Object.keys(values).length) return res.status(400).json({ message: 'Indique au moins un champ à modifier.' });
  const friend = await Friend.findByIdAndUpdate(req.params.id, { $set: values }, { new: true, runValidators: true });
  if (!friend) return res.status(404).json({ message: 'Ami introuvable.' });
  return res.status(200).json(friend);
}));

router.delete('/:id', checkId, asyncRoute(async (req, res) => {
  const friend = await Friend.findByIdAndDelete(req.params.id);
  if (!friend) return res.status(404).json({ message: 'Ami introuvable.' });
  return res.status(200).json({ message: 'Ami supprimé.', id: friend._id });
}));

module.exports = router;
