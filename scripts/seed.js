// Runs sql/03_seed.sql against the configured database.
// Usage: npm run seed
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/db/pool');

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'sql', '03_seed.sql'), 'utf8');
  await pool.query(sql);
  console.log('Seed data inserted.');
  await pool.end();
}

run().catch((err) => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});
