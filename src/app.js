const express = require('express');
const cors = require('cors');
const flightsRoutes = require('./routes/flights.routes');
const bookingsRoutes = require('./routes/bookings.routes');
const passengersRoutes = require('./routes/passengers.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const { AppError } = require('./utils/errors');

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/flights', flightsRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/passengers', passengersRoutes);
app.use('/api/analytics', analyticsRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Centralized error handler. AppError subclasses carry their own
// statusCode; PostgreSQL constraint violations are translated to
// readable 400s instead of leaking raw driver errors.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Postgres error codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Duplicate value violates a unique constraint', detail: err.detail });
  }
  if (err.code === '23514') {
    return res.status(400).json({ error: 'Value violates a check constraint', detail: err.detail });
  }
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Value violates a foreign key constraint', detail: err.detail });
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
