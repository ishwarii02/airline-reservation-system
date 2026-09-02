const { pool, withTransaction } = require('../db/pool');
const paymentService = require('./payment.service');
const {
  SeatUnavailableError,
  NotFoundError,
  AppError,
} = require('../utils/errors');

// ---------------------------------------------------------
// Read-only helpers (no locking needed, plain pool queries)
// ---------------------------------------------------------

async function searchFlights({ source, destination, date }) {
  const conditions = [];
  const params = [];

  if (source) {
    params.push(source.toUpperCase());
    conditions.push(`source = $${params.length}`);
  }
  if (destination) {
    params.push(destination.toUpperCase());
    conditions.push(`destination = $${params.length}`);
  }
  if (date) {
    params.push(date);
    conditions.push(`departure_time::date = $${params.length}::date`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT flight_id, flight_number, source, destination, departure_time, arrival_time, base_price
     FROM flight
     ${where}
     ORDER BY departure_time ASC`,
    params
  );
  return rows;
}

async function getFlightSeats(flightId) {
  const { rows } = await pool.query(
    `SELECT flight_seat_id, flight_id, seat_id, seat_number, seat_class, price, status
     FROM v_flight_seat_availability
     WHERE flight_id = $1
     ORDER BY seat_number`,
    [flightId]
  );
  if (rows.length === 0) {
    // Distinguish "flight doesn't exist" from "flight exists, no seats" isn't
    // needed for this project's scope; treat empty as not-found for simplicity.
    const flight = await pool.query('SELECT 1 FROM flight WHERE flight_id = $1', [flightId]);
    if (flight.rowCount === 0) throw new NotFoundError(`Flight ${flightId} not found`);
  }
  return rows;
}

async function getBookingHistory(passengerId) {
  const { rows } = await pool.query(
    `SELECT * FROM v_booking_summary WHERE passenger_id = $1 ORDER BY created_at DESC`,
    [passengerId]
  );
  return rows;
}

// `queryable` defaults to the shared pool for normal reads, but callers
// inside an open transaction (confirmBooking, cancelBooking) MUST pass
// their transaction's `client` here. Reading via the pool instead of the
// transaction's own client would use a *different* connection, which
// cannot see this transaction's uncommitted UPDATEs yet — the read would
// silently return stale pre-transaction data instead of the new state.
async function getBookingById(bookingId, queryable = pool) {
  const { rows } = await queryable.query(
    `SELECT * FROM v_booking_summary WHERE booking_id = $1`,
    [bookingId]
  );
  if (rows.length === 0) throw new NotFoundError(`Booking ${bookingId} not found`);
  return rows[0];
}

// ---------------------------------------------------------
// THE CORE OF THE PROJECT: locking a seat for booking.
//
// Multiple concurrent requests for the same seat will all reach
// `SELECT ... FOR UPDATE` at roughly the same time. PostgreSQL
// guarantees only one transaction can hold the row lock at once;
// every other transaction blocks on that statement until the
// first COMMITs or ROLLBACKs. Once unblocked, they re-read the
// row's *current* status (not a stale snapshot), see it is no
// longer 'AVAILABLE', and fail cleanly with SeatUnavailableError.
// This is exactly what makes "exactly one booking succeeds" true
// under real concurrent load, not just in a single-threaded test.
// ---------------------------------------------------------
async function lockSeatsForBooking({ passengerId, flightId, seatNumbers }) {
  if (!Array.isArray(seatNumbers) || seatNumbers.length === 0) {
    throw new AppError('seatNumbers must be a non-empty array');
  }
  const uniqueSeatNumbers = [...new Set(seatNumbers)];

  return withTransaction(async (client) => {
    // Lock candidate rows in a stable order (by flight_seat_id) so that
    // two multi-seat bookings that overlap on seats never deadlock —
    // both transactions always attempt to acquire locks in the same order.
    const { rows: candidateSeats } = await client.query(
      `SELECT fs.flight_seat_id, fs.status, fs.price, s.seat_number
       FROM flight_seat fs
       JOIN seat s ON s.seat_id = fs.seat_id
       WHERE fs.flight_id = $1 AND s.seat_number = ANY($2::text[])
       ORDER BY fs.flight_seat_id
       FOR UPDATE OF fs`,
      [flightId, uniqueSeatNumbers]
    );

    if (candidateSeats.length !== uniqueSeatNumbers.length) {
      throw new NotFoundError('One or more seat numbers do not exist on this flight');
    }

    const unavailable = candidateSeats.filter((s) => s.status !== 'AVAILABLE');
    if (unavailable.length > 0) {
      throw new SeatUnavailableError(
        `Seat(s) already taken: ${unavailable.map((s) => s.seat_number).join(', ')}`
      );
    }

    const flightSeatIds = candidateSeats.map((s) => s.flight_seat_id);
    const totalAmount = candidateSeats.reduce((sum, s) => sum + Number(s.price), 0);

    await client.query(
      `UPDATE flight_seat SET status = 'LOCKED', locked_at = now()
       WHERE flight_seat_id = ANY($1::int[])`,
      [flightSeatIds]
    );

    const { rows: bookingRows } = await client.query(
      `INSERT INTO booking (passenger_id, flight_id, booking_status, total_amount)
       VALUES ($1, $2, 'PENDING', $3)
       RETURNING booking_id, booking_status, total_amount, created_at`,
      [passengerId, flightId, totalAmount]
    );
    const booking = bookingRows[0];

    for (const seat of candidateSeats) {
      await client.query(
        `INSERT INTO booking_seat (booking_id, flight_seat_id, price_at_booking)
         VALUES ($1, $2, $3)`,
        [booking.booking_id, seat.flight_seat_id, seat.price]
      );
    }

    return {
      ...booking,
      seats: candidateSeats.map((s) => ({ seat_number: s.seat_number, price: s.price })),
    };
  });
}

// ---------------------------------------------------------
// Confirm a PENDING booking: charge payment, then either mark
// the seats BOOKED or release them back to AVAILABLE. Both the
// payment outcome and the seat/booking status change commit
// together in one transaction, so the system can never end up
// with "paid but not booked" or "booked but not paid".
// ---------------------------------------------------------
async function confirmBooking({ bookingId, paymentMethod, forcePaymentOutcome }) {
  return withTransaction(async (client) => {
    const { rows: bookingRows } = await client.query(
      `SELECT booking_id, booking_status, total_amount, passenger_id, flight_id
       FROM booking WHERE booking_id = $1 FOR UPDATE`,
      [bookingId]
    );
    if (bookingRows.length === 0) throw new NotFoundError(`Booking ${bookingId} not found`);
    const booking = bookingRows[0];

    if (booking.booking_status !== 'PENDING') {
      throw new AppError(
        `Booking ${bookingId} cannot be confirmed from status ${booking.booking_status}`,
        409
      );
    }

    const { rows: seatRows } = await client.query(
      `SELECT fs.flight_seat_id
       FROM booking_seat bs
       JOIN flight_seat fs ON fs.flight_seat_id = bs.flight_seat_id
       WHERE bs.booking_id = $1
       ORDER BY fs.flight_seat_id
       FOR UPDATE OF fs`,
      [bookingId]
    );
    const flightSeatIds = seatRows.map((r) => r.flight_seat_id);

    const paymentResult = await paymentService.charge({
      amount: booking.total_amount,
      method: paymentMethod,
      forceOutcome: forcePaymentOutcome,
    });

    await client.query(
      `INSERT INTO payment (booking_id, amount, status, payment_method, transaction_ref)
       VALUES ($1, $2, $3, $4, $5)`,
      [bookingId, booking.total_amount, paymentResult.status, paymentResult.method, paymentResult.transactionRef]
    );

    if (paymentResult.status === 'SUCCESS') {
      await client.query(
        `UPDATE flight_seat SET status = 'BOOKED' WHERE flight_seat_id = ANY($1::int[])`,
        [flightSeatIds]
      );
      await client.query(`UPDATE booking SET booking_status = 'CONFIRMED' WHERE booking_id = $1`, [
        bookingId,
      ]);
    } else {
      // Payment failed: release the seats immediately so other
      // passengers aren't stuck waiting for the lock timeout.
      await client.query(
        `UPDATE flight_seat SET status = 'AVAILABLE', locked_at = NULL WHERE flight_seat_id = ANY($1::int[])`,
        [flightSeatIds]
      );
      await client.query(`UPDATE booking SET booking_status = 'FAILED' WHERE booking_id = $1`, [
        bookingId,
      ]);
    }

    return getBookingById(bookingId, client);
  });
}

// ---------------------------------------------------------
// Cancel a booking (PENDING or CONFIRMED). Releases its seats
// back to AVAILABLE and, if a successful payment existed, marks
// it REFUNDED (simulated — no real refund flow).
// ---------------------------------------------------------
async function cancelBooking(bookingId) {
  return withTransaction(async (client) => {
    const { rows: bookingRows } = await client.query(
      `SELECT booking_id, booking_status FROM booking WHERE booking_id = $1 FOR UPDATE`,
      [bookingId]
    );
    if (bookingRows.length === 0) throw new NotFoundError(`Booking ${bookingId} not found`);
    const booking = bookingRows[0];

    if (!['PENDING', 'CONFIRMED'].includes(booking.booking_status)) {
      throw new AppError(
        `Booking ${bookingId} cannot be cancelled from status ${booking.booking_status}`,
        409
      );
    }

    const { rows: seatRows } = await client.query(
      `SELECT fs.flight_seat_id
       FROM booking_seat bs
       JOIN flight_seat fs ON fs.flight_seat_id = bs.flight_seat_id
       WHERE bs.booking_id = $1
       ORDER BY fs.flight_seat_id
       FOR UPDATE OF fs`,
      [bookingId]
    );
    const flightSeatIds = seatRows.map((r) => r.flight_seat_id);

    await client.query(
      `UPDATE flight_seat SET status = 'AVAILABLE', locked_at = NULL WHERE flight_seat_id = ANY($1::int[])`,
      [flightSeatIds]
    );
    await client.query(`UPDATE booking SET booking_status = 'CANCELLED' WHERE booking_id = $1`, [
      bookingId,
    ]);
    await client.query(
      `UPDATE payment SET status = 'REFUNDED' WHERE booking_id = $1 AND status = 'SUCCESS'`,
      [bookingId]
    );

    return getBookingById(bookingId, client);
  });
}

module.exports = {
  searchFlights,
  getFlightSeats,
  getBookingHistory,
  getBookingById,
  lockSeatsForBooking,
  confirmBooking,
  cancelBooking,
};
