const express = require('express');
const Client = require('../models/Client');

const router = express.Router();

function sendError(res, error) {
  if (error.code === 11000) return res.status(409).json({ message: 'Cette adresse email existe déjà.' });
  if (error.name === 'ValidationError') return res.status(400).json({ message: error.message });
  if (error.name === 'CastError') return res.status(400).json({ message: 'Identifiant invalide.' });
  console.error(error);
  return res.status(500).json({ message: 'Une erreur est survenue côté serveur.' });
}

router.get('/', async (_req, res) => {
  try {
    const clients = await Client.find().sort({ createdAt: -1 });
    return res.status(200).json(clients);
  } catch (error) { return sendError(res, error); }
});

router.get('/:id', async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client introuvable.' });
    return res.status(200).json(client);
  } catch (error) { return sendError(res, error); }
});

router.post('/', async (req, res) => {
  try {
    const client = await Client.create(req.body);
    return res.status(201).json(client);
  } catch (error) { return sendError(res, error); }
});

router.patch('/:id', async (req, res) => {
  try {
    const client = await Client.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!client) return res.status(404).json({ message: 'Client introuvable.' });
    return res.status(200).json(client);
  } catch (error) { return sendError(res, error); }
});

router.delete('/:id', async (req, res) => {
  try {
    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client introuvable.' });
    return res.status(200).json({ message: 'Client supprimé.' });
  } catch (error) { return sendError(res, error); }
});

module.exports = router;
