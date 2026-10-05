require('dotenv').config();
const createApp = require('./app');
const { getPool } = require('./config/mysql');
const { connectMongo } = require('./config/mongo');

const PORT = process.env.PORT || 3000;

async function start() {
  // Fail fast if MySQL isn't reachable, rather than starting an API that
  // can't serve any real request.
  await getPool().query('SELECT 1');
  await connectMongo();

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`booking-api listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
