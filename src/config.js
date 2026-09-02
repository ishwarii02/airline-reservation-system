require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  db: {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'airline_user',
    password: process.env.PGPASSWORD || 'airline_pass',
    database: process.env.PGDATABASE || 'airline_db',
  },
  seatLockTimeoutMinutes: parseInt(process.env.SEAT_LOCK_TIMEOUT_MINUTES || '5', 10),
};
