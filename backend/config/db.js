const mongoose = require('mongoose');

let connectionPromise;

mongoose.connection.on('disconnected', () => {
  connectionPromise = null;
});

function connectDB() {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection);
  if (connectionPromise) return connectionPromise;

  const uri = process.env.MONGODB_URI;
  if (!uri) return Promise.reject(new Error('La variable MONGODB_URI est absente.'));

  const timeoutMs = Number(process.env.MONGODB_CONNECT_TIMEOUT_MS) || 10000;
  connectionPromise = mongoose.connect(uri, {
    serverSelectionTimeoutMS: timeoutMs,
    maxPoolSize: 10,
  })
    .then(() => {
      console.info('✅ MongoDB connecté.');
      return mongoose.connection;
    })
    .catch((error) => {
      connectionPromise = null;
      throw error;
    });
  return connectionPromise;
}

module.exports = connectDB;
