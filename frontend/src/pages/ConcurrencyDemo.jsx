import { useState } from 'react';
import { api } from '../api';

// This is the actual proof-of-concept for the project: it fires N real,
// simultaneous HTTP requests at the live backend for the same seat and
// checks that PostgreSQL's row-level locking lets exactly one succeed.
// Nothing here is simulated — every request hits the running Express
// server and its Postgres transactions.
export default function ConcurrencyDemo() {
  const [flightId, setFlightId] = useState('1');
  const [seatNumber, setSeatNumber] = useState('3A');
  const [userCount, setUserCount] = useState(10);
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  async function runRace() {
    setError(null);
    setResults([]);
    setRunning(true);

    const n = Number(userCount);
    const attempts = Array.from({ length: n }, (_, i) => i + 1);

    try {
      const runs = attempts.map(async (i) => {
        const passengerId = ((i - 1) % 5) + 1; // cycle through seeded passengers 1–5
        const start = performance.now();
        try {
          const booking = await api.lockSeats({
            passengerId,
            flightId: Number(flightId),
            seatNumbers: [seatNumber],
          });
          return {
            passengerId,
            result: 'WON',
            detail: `booking_id=${booking.booking_id}`,
            latency: Math.round(performance.now() - start),
          };
        } catch (err) {
          return {
            passengerId,
            result: 'LOST',
            detail: `${err.status ?? ''} ${err.message}`.trim(),
            latency: Math.round(performance.now() - start),
          };
        }
      });

      const settled = await Promise.all(runs);
      settled.sort((a, b) => a.latency - b.latency);
      setResults(settled);
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  const won = results.filter((r) => r.result === 'WON').length;
  const lost = results.filter((r) => r.result === 'LOST').length;

  return (
    <div className="page">
      <section className="panel">
        <h2>Concurrency test</h2>
        <p className="hint">
          Sends {userCount} real, simultaneous <code>POST /api/bookings/lock</code> requests at the
          same seat. Expect exactly one <strong>WON (201)</strong> and the rest <strong>LOST (409)</strong>.
          Equivalent to running <code>node tests/concurrency-test.js {flightId} {seatNumber} {userCount}</code> from the terminal.
        </p>

        <div className="form-row">
          <label>
            Flight ID
            <input value={flightId} onChange={(e) => setFlightId(e.target.value)} style={{ width: 70 }} />
          </label>
          <label>
            Seat number
            <input value={seatNumber} onChange={(e) => setSeatNumber(e.target.value)} style={{ width: 70 }} />
          </label>
          <label>
            Concurrent users
            <input
              type="number"
              min="2"
              max="30"
              value={userCount}
              onChange={(e) => setUserCount(e.target.value)}
              style={{ width: 70 }}
            />
          </label>
          <button onClick={runRace} disabled={running}>
            {running ? 'Racing…' : 'Fire the race'}
          </button>
        </div>

        <p className="hint">
          The target seat must be AVAILABLE before you run this. To re-run against the same seat,
          reset the database: <code>./scripts/reset-db.sh</code>.
        </p>

        {error && <p className="error">{error}</p>}

        {results.length > 0 && (
          <>
            <div className="stat-row">
              <div className="stat"><span className="stat-num">{won}</span><span className="stat-label">WON</span></div>
              <div className="stat"><span className="stat-num">{lost}</span><span className="stat-label">LOST</span></div>
              <div className="stat">
                <span className="stat-num">{won === 1 ? 'PASS' : 'CHECK'}</span>
                <span className="stat-label">exactly-one invariant</span>
              </div>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>Result</th>
                  <th>Passenger</th>
                  <th>Latency</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i}>
                    <td><span className={`badge badge-${r.result}`}>{r.result}</span></td>
                    <td>#{r.passengerId}</td>
                    <td>{r.latency}ms</td>
                    <td>{r.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </div>
  );
}
