const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('La variable MONGODB_URI est absente.');

  mongoose.connection.on('connected', () => console.info('✅ MongoDB connecté.'));
  mongoose.connection.on('error', (error) => console.error('Erreur MongoDB :', error.message));
  await mongoose.connect(uri);
}

module.exports = connectDB;
