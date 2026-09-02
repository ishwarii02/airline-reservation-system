const bookingService = require('../services/booking.service');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/flights?source=BOM&destination=DEL&date=2026-08-20
const search = asyncHandler(async (req, res) => {
  const { source, destination, date } = req.query;
  const flights = await bookingService.searchFlights({ source, destination, date });
  res.json({ count: flights.length, flights });
});

// GET /api/flights/:id/seats
const seatAvailability = asyncHandler(async (req, res) => {
  const flightId = parseInt(req.params.id, 10);
  const seats = await bookingService.getFlightSeats(flightId);
  res.json({ flightId, count: seats.length, seats });
});

module.exports = { search, seatAvailability };
