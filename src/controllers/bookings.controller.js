const bookingService = require('../services/booking.service');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');

// POST /api/bookings/lock
// body: { passengerId, flightId, seatNumbers: ["3A", "3B"] }
// Creates a PENDING booking and moves the requested seats to LOCKED.
// This is the endpoint the concurrency test hammers concurrently.
const lockSeats = asyncHandler(async (req, res) => {
  const { passengerId, flightId, seatNumbers } = req.body;
  if (!passengerId || !flightId) {
    throw new AppError('passengerId and flightId are required');
  }
  const booking = await bookingService.lockSeatsForBooking({
    passengerId,
    flightId,
    seatNumbers,
  });
  res.status(201).json(booking);
});

// POST /api/bookings/:id/confirm
// body: { paymentMethod }  (optional: forcePaymentOutcome for demos/tests)
const confirm = asyncHandler(async (req, res) => {
  const bookingId = parseInt(req.params.id, 10);
  const { paymentMethod, forcePaymentOutcome } = req.body || {};
  const booking = await bookingService.confirmBooking({
    bookingId,
    paymentMethod,
    forcePaymentOutcome,
  });
  res.json(booking);
});

// POST /api/bookings/:id/cancel
const cancel = asyncHandler(async (req, res) => {
  const bookingId = parseInt(req.params.id, 10);
  const booking = await bookingService.cancelBooking(bookingId);
  res.json(booking);
});

// GET /api/bookings/:id
const getOne = asyncHandler(async (req, res) => {
  const bookingId = parseInt(req.params.id, 10);
  const booking = await bookingService.getBookingById(bookingId);
  res.json(booking);
});

module.exports = { lockSeats, confirm, cancel, getOne };
