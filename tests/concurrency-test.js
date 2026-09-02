/**
 * Concurrency test — the centerpiece demo of this project.
 *
 * N "passengers" fire simultaneous HTTP requests to lock the SAME
 * seat on the SAME flight. Thanks to `SELECT ... FOR UPDATE` inside
 * a single transaction in booking.service.js, PostgreSQL serializes
 * access to that row: exactly one request should succeed (HTTP 201)
 * and every other request should fail with HTTP 409 Seat Unavailable.
 *
 * Usage:
 *   node tests/concurrency-test.js [flightId] [seatNumber] [numUsers]
 *
 * Requires the server to be running (npm start) and the DB seeded
 * with at least `numUsers` passengers (passenger_id 1..N) and the
 * given flight/seat AVAILABLE.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const flightId = parseInt(process.argv[2] || '1', 10);
const seatNumber = process.argv[3] || '3A';
const numUsers = parseInt(process.argv[4] || '5', 10);

function log(...args) {
  console.log(...args);
}

// Create fresh passengers for this test run instead of assuming the seed
// data has exactly `numUsers` rows — keeps the test self-contained and
// re-runnable regardless of how many bookings/passengers already exist.
async function createPassenger(i) {
  const res = await fetch(`${BASE_URL}/api/passengers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: `Concurrency Tester ${i}`,
      email: `concurrency_test_${Date.now()}_${i}@example.com`,
      phone: `90000000${String(i).padStart(2, '0')}`,
    }),
  });
  const body = await res.json();
  return body.passenger_id;
}

async function attemptLock(passengerId) {
  const startedAt = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/api/bookings/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passengerId, flightId, seatNumbers: [seatNumber] }),
    });
    const body = await res.json();
    return { passengerId, status: res.status, body, ms: Date.now() - startedAt };
  } catch (err) {
    return { passengerId, status: 'ERROR', body: { error: err.message }, ms: Date.now() - startedAt };
  }
}

async function main() {
  log(`\nConcurrency test: ${numUsers} passengers racing for seat ${seatNumber} on flight ${flightId}`);
  log(`Target: ${BASE_URL}\n`);

  const passengerIds = await Promise.all(
    Array.from({ length: numUsers }, (_, i) => createPassenger(i + 1))
  );

  // Fire all requests in the same tick so they hit the server (and the
  // same DB row) as close to simultaneously as possible.
  const results = await Promise.all(passengerIds.map((id) => attemptLock(id)));

  results.sort((a, b) => a.ms - b.ms);

  const succeeded = results.filter((r) => r.status === 201);
  const conflicted = results.filter((r) => r.status === 409);
  const other = results.filter((r) => r.status !== 201 && r.status !== 409);

  log('Result | Passenger | HTTP | Latency | Detail');
  log('-------|-----------|------|---------|-------');
  for (const r of results) {
    const tag = r.status === 201 ? 'WON  ' : r.status === 409 ? 'LOST ' : 'ERR  ';
    const detail = r.status === 201 ? `booking_id=${r.body.booking_id}` : r.body.error;
    log(`${tag}  | ${String(r.passengerId).padEnd(9)} | ${String(r.status).padEnd(4)} | ${String(r.ms).padStart(5)}ms | ${detail}`);
  }

  log(`\nSucceeded: ${succeeded.length}  Conflicted(409): ${conflicted.length}  Other: ${other.length}`);

  if (succeeded.length === 1 && conflicted.length === numUsers - 1 && other.length === 0) {
    log('\nPASS: exactly one passenger won the seat; all others were correctly rejected.\n');
    process.exit(0);
  } else {
    log('\nFAIL: expected exactly 1 success and the rest 409 Conflict.');
    log('If you already ran this test once, reset the DB first (npm run seed after scripts/reset-db.sh).\n');
    process.exit(1);
  }
}

main();
