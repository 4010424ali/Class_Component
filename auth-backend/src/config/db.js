const mongoose = require('mongoose');

/**
 * Connect to MongoDB.
 * Retries up to 5 times with exponential back-off before giving up.
 */
async function connectDB() {
  const uri     = process.env.MONGO_URI;
  const maxTries = 5;

  for (let attempt = 1; attempt <= maxTries; attempt++) {
    try {
      await mongoose.connect(uri, {
        // Connection pool — adjust based on expected concurrency
        maxPoolSize: 10,
      });
      console.log(`[MongoDB] Connected to ${mongoose.connection.name}`);
      return;
    } catch (err) {
      console.error(`[MongoDB] Connection attempt ${attempt}/${maxTries} failed: ${err.message}`);
      if (attempt === maxTries) {
        console.error('[MongoDB] All connection attempts exhausted. Exiting.');
        process.exit(1);
      }
      const backoffMs = Math.pow(2, attempt) * 1000;
      await new Promise(r => setTimeout(r, backoffMs));
    }
  }
}

// Log connection lifecycle events
mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB] Disconnected.');
});

mongoose.connection.on('reconnected', () => {
  console.log('[MongoDB] Reconnected.');
});

module.exports = connectDB;
