const mongoose = require('mongoose');
const app = require('../src/app');

let connectionPromise = null;

function getConnection() {
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(process.env.MONGO_URI).catch((err) => {
      connectionPromise = null;
      throw err;
    });
  }
  return connectionPromise;
}

module.exports = async (req, res) => {
  try {
    await getConnection();
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Database connection failed' }));
    return;
  }
  return app(req, res);
};
