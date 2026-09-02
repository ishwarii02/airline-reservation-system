const { pool } = require('../db/pool');
const bookingService = require('../services/booking.service');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');

// POST /api/passengers  { fullName, email, phone }
const create = asyncHandler(async (req, res) => {
  const { fullName, email, phone } = req.body;
  if (!fullName || !email || !phone) {
    throw new AppError('fullName, email and phone are required');
  }
  const { rows } = await pool.query(
    `INSERT INTO passenger (full_name, email, phone) VALUES ($1, $2, $3)
     RETURNING passenger_id, full_name, email, phone, created_at`,
    [fullName, email, phone]
  );
  res.status(201).json(rows[0]);
});

// GET /api/passengers/:id/bookings
const bookingHistory = asyncHandler(async (req, res) => {
  const passengerId = parseInt(req.params.id, 10);
  const bookings = await bookingService.getBookingHistory(passengerId);
  res.json({ passengerId, count: bookings.length, bookings });
});

module.exports = { create, bookingHistory };
