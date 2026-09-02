const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool(config.db);

pool.on('error', (err) => {
  // Errors on idle clients should never crash the whole process.
  console.error('Unexpected error on idle PostgreSQL client', err);
});

/**
 * Run `fn(client)` inside a single BEGIN/COMMIT transaction.
 * On any error inside fn, the transaction is rolled back and
 * the error is re-thrown to the caller.
 *
 * This is the ONLY place transactions are opened/closed, so
 * every booking-related code path gets the same guarantees.
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Rollback failed', rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, withTransaction };
