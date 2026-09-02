const { withTransaction } = require('../db/pool');
const config = require('../config');

/**
 * Releases seats that have been LOCKED (a booking was started but
 * never confirmed) past the configured timeout, and marks their
 * still-PENDING bookings as FAILED. Runs both steps in one
 * transaction so a seat is never left LOCKED with no owning
 * PENDING booking, or vice versa.
 */
async function releaseExpiredLocks() {
  return withTransaction(async (client) => {
    const { rows: expiredSeats } = await client.query(
      `SELECT flight_seat_id FROM flight_seat
       WHERE status = 'LOCKED'
         AND locked_at < now() - ($1 || ' minutes')::interval
       ORDER BY flight_seat_id
       FOR UPDATE`,
      [config.seatLockTimeoutMinutes]
    );

    if (expiredSeats.length === 0) return { releasedSeats: 0, failedBookings: 0 };

    const flightSeatIds = expiredSeats.map((r) => r.flight_seat_id);

    await client.query(
      `UPDATE flight_seat SET status = 'AVAILABLE', locked_at = NULL
       WHERE flight_seat_id = ANY($1::int[])`,
      [flightSeatIds]
    );

    const { rows: failedBookings } = await client.query(
      `UPDATE booking SET booking_status = 'FAILED'
       WHERE booking_status = 'PENDING'
         AND booking_id IN (
           SELECT DISTINCT bs.booking_id
           FROM booking_seat bs
           WHERE bs.flight_seat_id = ANY($1::int[])
         )
       RETURNING booking_id`,
      [flightSeatIds]
    );

    return { releasedSeats: flightSeatIds.length, failedBookings: failedBookings.length };
  });
}

function startLockCleanupJob(intervalMs = 60_000) {
  const timer = setInterval(async () => {
    try {
      const result = await releaseExpiredLocks();
      if (result.releasedSeats > 0) {
        console.log(
          `[lock-cleanup] released ${result.releasedSeats} expired seat lock(s), ` +
            `failed ${result.failedBookings} stale booking(s)`
        );
      }
    } catch (err) {
      console.error('[lock-cleanup] failed', err);
    }
  }, intervalMs);
  timer.unref(); // don't keep the process alive just for this timer
  return timer;
}

module.exports = { releaseExpiredLocks, startLockCleanupJob };
