const app = require('./app');
const config = require('./config');
const { pool } = require('./db/pool');
const { startLockCleanupJob } = require('./services/lock-cleanup.service');

async function main() {
  // Fail fast with a clear message if the DB isn't reachable,
  // instead of accepting requests that will all error out.
  await pool.query('SELECT 1');
  console.log('Connected to PostgreSQL');

  startLockCleanupJob();

  app.listen(config.port, () => {
    console.log(`Airline reservation API listening on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
