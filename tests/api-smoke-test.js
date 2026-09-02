/**
 * End-to-end smoke test covering the full booking lifecycle:
 * search -> seat availability -> lock -> confirm (payment) ->
 * booking history -> cancel -> seat released -> analytics.
 *
 * Requires the server running and a freshly seeded DB.
 * Usage: node tests/api-smoke-test.js
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  PASS - ${msg}`);
    passed++;
  } else {
    console.log(`  FAIL - ${msg}`);
    failed++;
  }
}

async function api(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

async function main() {
  console.log(`\nAPI smoke test against ${BASE_URL}\n`);

  console.log('1) Search flights BOM -> DEL');
  const search = await api('GET', '/api/flights?source=BOM&destination=DEL');
  assert(search.status === 200 && search.body.count >= 1, 'search returns at least one flight');
  const flight = search.body.flights[0];

  console.log('2) Seat availability for that flight');
  const seats = await api('GET', `/api/flights/${flight.flight_id}/seats`);
  assert(seats.status === 200 && seats.body.count === 28, 'flight has 28 seats (7 rows x 4)');
  const availableSeat = seats.body.seats.find((s) => s.status === 'AVAILABLE');
  assert(!!availableSeat, 'at least one seat is AVAILABLE');

  console.log('3) Create a passenger');
  const passenger = await api('POST', '/api/passengers', {
    fullName: 'Smoke Test User',
    email: `smoke_${Date.now()}@example.com`,
    phone: '9999999999',
  });
  assert(passenger.status === 201, 'passenger created');

  console.log('4) Lock a seat (creates PENDING booking)');
  const lock = await api('POST', '/api/bookings/lock', {
    passengerId: passenger.body.passenger_id,
    flightId: flight.flight_id,
    seatNumbers: [availableSeat.seat_number],
  });
  assert(lock.status === 201 && lock.body.booking_status === 'PENDING', 'booking created as PENDING');
  const bookingId = lock.body.booking_id;

  console.log('5) Locking the same seat again should now fail (409)');
  const relock = await api('POST', '/api/bookings/lock', {
    passengerId: passenger.body.passenger_id,
    flightId: flight.flight_id,
    seatNumbers: [availableSeat.seat_number],
  });
  assert(relock.status === 409, 'second lock attempt on same seat is rejected');

  console.log('6) Confirm booking with forced payment SUCCESS');
  const confirm = await api('POST', `/api/bookings/${bookingId}/confirm`, {
    forcePaymentOutcome: 'SUCCESS',
  });
  assert(confirm.status === 200 && confirm.body.booking_status === 'CONFIRMED', 'booking is CONFIRMED');

  console.log('7) Seat should now show as BOOKED');
  const seatsAfterConfirm = await api('GET', `/api/flights/${flight.flight_id}/seats`);
  const bookedSeat = seatsAfterConfirm.body.seats.find((s) => s.seat_number === availableSeat.seat_number);
  assert(bookedSeat.status === 'BOOKED', 'seat status is BOOKED after confirmation');

  console.log('8) Booking history for the passenger includes this booking');
  const history = await api('GET', `/api/passengers/${passenger.body.passenger_id}/bookings`);
  assert(
    history.status === 200 && history.body.bookings.some((b) => b.booking_id === bookingId),
    'booking appears in passenger history'
  );

  console.log('9) Cancel the booking');
  const cancel = await api('POST', `/api/bookings/${bookingId}/cancel`);
  assert(cancel.status === 200 && cancel.body.booking_status === 'CANCELLED', 'booking is CANCELLED');

  console.log('10) Seat should be AVAILABLE again after cancellation');
  const seatsAfterCancel = await api('GET', `/api/flights/${flight.flight_id}/seats`);
  const releasedSeat = seatsAfterCancel.body.seats.find((s) => s.seat_number === availableSeat.seat_number);
  assert(releasedSeat.status === 'AVAILABLE', 'seat status is AVAILABLE after cancellation');

  console.log('11) Lock + confirm with forced payment FAILURE releases the seat');
  const lock2 = await api('POST', '/api/bookings/lock', {
    passengerId: passenger.body.passenger_id,
    flightId: flight.flight_id,
    seatNumbers: [availableSeat.seat_number],
  });
  const confirmFail = await api('POST', `/api/bookings/${lock2.body.booking_id}/confirm`, {
    forcePaymentOutcome: 'FAILED',
  });
  assert(confirmFail.body.booking_status === 'FAILED', 'booking is FAILED when payment fails');
  const seatsAfterFail = await api('GET', `/api/flights/${flight.flight_id}/seats`);
  const seatAfterFail = seatsAfterFail.body.seats.find((s) => s.seat_number === availableSeat.seat_number);
  assert(seatAfterFail.status === 'AVAILABLE', 'seat released back to AVAILABLE after payment failure');

  console.log('12) Analytics endpoints respond');
  const occupancy = await api('GET', '/api/analytics/occupancy');
  const revenue = await api('GET', '/api/analytics/revenue');
  assert(occupancy.status === 200 && Array.isArray(occupancy.body), 'occupancy analytics ok');
  assert(revenue.status === 200 && Array.isArray(revenue.body), 'revenue analytics ok');

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
