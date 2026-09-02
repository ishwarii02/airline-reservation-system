import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Analytics() {
  const [occupancy, setOccupancy] = useState([]);
  const [revenue, setRevenue] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const [occ, rev] = await Promise.all([api.getOccupancy(), api.getRevenue()]);
      setOccupancy(occ);
      setRevenue(rev);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function runCleanup() {
    setError(null);
    try {
      const result = await api.releaseExpiredLocks();
      alert(`Released ${result.releasedSeats} seat(s), failed ${result.failedBookings} booking(s)`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="page">
      <section className="panel">
        <div className="form-row">
          <h2 style={{ margin: 0 }}>Analytics</h2>
          <button onClick={load} disabled={loading}>Refresh</button>
          <button onClick={runCleanup}>Release expired seat locks</button>
        </div>

        {error && <p className="error">{error}</p>}

        <h3>Occupancy</h3>
        <table className="table">
          <thead>
            <tr><th>Flight</th><th>Route</th><th>Booked / Total</th><th>Occupancy</th></tr>
          </thead>
          <tbody>
            {occupancy.map((o) => (
              <tr key={o.flight_id}>
                <td>{o.flight_number}</td>
                <td>{o.source} → {o.destination}</td>
                <td>{o.booked_seats} / {o.total_seats}</td>
                <td>{o.occupancy_pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>Confirmed revenue</h3>
        <table className="table">
          <thead>
            <tr><th>Flight</th><th>Revenue</th></tr>
          </thead>
          <tbody>
            {revenue.map((r) => (
              <tr key={r.flight_id}>
                <td>{r.flight_number}</td>
                <td>₹{r.confirmed_revenue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
