const { pool } = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const lockCleanup = require('../services/lock-cleanup.service');

// GET /api/analytics/occupancy
const occupancy = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT
        f.flight_id, f.flight_number, f.source, f.destination,
        COUNT(fs.flight_seat_id) AS total_seats,
        COUNT(*) FILTER (WHERE fs.status = 'BOOKED') AS booked_seats,
        ROUND(100.0 * COUNT(*) FILTER (WHERE fs.status = 'BOOKED')
              / NULLIF(COUNT(fs.flight_seat_id), 0), 2) AS occupancy_pct
    FROM flight f
    JOIN flight_seat fs ON fs.flight_id = f.flight_id
    GROUP BY f.flight_id, f.flight_number, f.source, f.destination
    ORDER BY occupancy_pct DESC
  `);
  res.json(rows);
});

// GET /api/analytics/revenue
const revenue = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT f.flight_id, f.flight_number, COALESCE(SUM(p.amount), 0) AS confirmed_revenue
    FROM flight f
    LEFT JOIN booking b ON b.flight_id = f.flight_id AND b.booking_status = 'CONFIRMED'
    LEFT JOIN payment p ON p.booking_id = b.booking_id AND p.status = 'SUCCESS'
    GROUP BY f.flight_id, f.flight_number
    ORDER BY confirmed_revenue DESC
  `);
  res.json(rows);
});

// POST /api/analytics/release-expired-locks  (manual trigger for demo purposes)
const releaseExpiredLocks = asyncHandler(async (req, res) => {
  const result = await lockCleanup.releaseExpiredLocks();
  res.json(result);
});

module.exports = { occupancy, revenue, releaseExpiredLocks };
