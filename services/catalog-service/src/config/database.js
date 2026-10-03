const mongoose = require('mongoose');

async function connectDatabase() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI deve estar definido');
  }

  await mongoose.connect(process.env.MONGO_URI);
}

module.exports = { connectDatabase };
