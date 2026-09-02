import { useState } from 'react';
import { api } from '../api';
import StatusBadge from '../components/StatusBadge.jsx';

export default function BookingHistory() {
  const [passengerId, setPassengerId] = useState('1');
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const data = await api.getBookingHistory(Number(passengerId));
      setBookings(data.bookings);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function cancel(bookingId) {
    setError(null);
    try {
      await api.cancelBooking(bookingId);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <section className="panel">
        <h2>Booking history</h2>
        <div className="form-row">
          <label>
            Passenger ID
            <input value={passengerId} onChange={(e) => setPassengerId(e.target.value)} style={{ width: 80 }} />
          </label>
          <button onClick={load} disabled={loading}>Load</button>
        </div>

        {error && <p className="error">{error}</p>}

        <table className="table">
          <thead>
            <tr>
              <th>Booking</th>
              <th>Flight</th>
              <th>Seats</th>
              <th>Status</th>
              <th>Total</th>
              <th>Payment</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.booking_id}>
                <td>#{b.booking_id}</td>
                <td>{b.flight_number} ({b.source}→{b.destination})</td>
                <td>{(b.seats || []).map((s) => s.seat_number).join(', ')}</td>
                <td><StatusBadge status={b.booking_status} /></td>
                <td>₹{b.total_amount}</td>
                <td>{b.payment ? <StatusBadge status={b.payment.status} /> : '—'}</td>
                <td>
                  {['PENDING', 'CONFIRMED'].includes(b.booking_status) && (
                    <button onClick={() => cancel(b.booking_id)}>Cancel</button>
                  )}
                </td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr><td colSpan="7" className="empty">No bookings loaded yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
