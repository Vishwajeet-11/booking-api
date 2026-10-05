const mongoose = require('mongoose');

async function connectMongo() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/booking_api';
  mongoose.connection.on('error', (err) => {
    console.error('[mongo] connection error:', err.message);
  });
  await mongoose.connect(uri);
  return mongoose.connection;
}

async function disconnectMongo() {
  await mongoose.disconnect();
}

module.exports = { connectMongo, disconnectMongo };
