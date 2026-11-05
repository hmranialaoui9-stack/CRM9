const mongoose = require('mongoose');
const Client = require('../models/Client');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const validId = (id) => mongoose.isValidObjectId(id);

exports.getClients = asyncHandler(async (_req, res) => {
  const clients = await Client.find().sort({ updatedAt: -1 });
  res.json({ success: true, data: clients });
});

exports.getClient = asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ success: false, message: 'Identifiant client invalide.' });
  const client = await Client.findById(req.params.id);
  if (!client) return res.status(404).json({ success: false, message: 'Client introuvable.' });
  res.json({ success: true, data: client });
});

exports.createClient = asyncHandler(async (req, res) => {
  const client = await Client.create(req.body);
  res.status(201).json({ success: true, message: 'Client créé.', data: client });
});

exports.updateClient = asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ success: false, message: 'Identifiant client invalide.' });
  const client = await Client.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true, context: 'query' });
  if (!client) return res.status(404).json({ success: false, message: 'Client introuvable.' });
  res.json({ success: true, message: 'Client mis à jour.', data: client });
});

exports.deleteClient = asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ success: false, message: 'Identifiant client invalide.' });
  const client = await Client.findByIdAndDelete(req.params.id);
  if (!client) return res.status(404).json({ success: false, message: 'Client introuvable.' });
  res.json({ success: true, message: 'Client supprimé.' });
});
