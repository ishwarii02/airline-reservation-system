import { useEffect, useState } from 'react';
import { api } from '../api';
import SeatGrid from '../components/SeatGrid.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

export default function BookFlight() {
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [flights, setFlights] = useState([]);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [seats, setSeats] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [passengerId, setPassengerId] = useState('1');
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function loadFlights() {
    setError(null);
    try {
      const data = await api.searchFlights({ source, destination });
      setFlights(data.flights);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadFlights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function selectFlight(flight) {
    setSelectedFlight(flight);
    setSelectedSeats([]);
    setBooking(null);
    setError(null);
    try {
      const data = await api.getFlightSeats(flight.flight_id);
      setSeats(data.seats);
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleSeat(seatNumber) {
    setSelectedSeats((prev) =>
      prev.includes(seatNumber) ? prev.filter((s) => s !== seatNumber) : [...prev, seatNumber]
    );
  }

  async function lockSeats() {
    setError(null);
    setLoading(true);
    try {
      const result = await api.lockSeats({
        passengerId: Number(passengerId),
        flightId: selectedFlight.flight_id,
        seatNumbers: selectedSeats,
      });
      setBooking(result);
      setSelectedSeats([]);
      await refreshSeats();
    } catch (err) {
      setError(`${err.status ?? ''} ${err.message}`.trim());
    } finally {
      setLoading(false);
    }
  }

  async function refreshSeats() {
    if (!selectedFlight) return;
    const data = await api.getFlightSeats(selectedFlight.flight_id);
    setSeats(data.seats);
  }

  async function confirm(forcePaymentOutcome) {
    setError(null);
    setLoading(true);
    try {
      const result = await api.confirmBooking(
        booking.booking_id,
        forcePaymentOutcome ? { forcePaymentOutcome } : {}
      );
      setBooking(result);
      await refreshSeats();
    } catch (err) {
      setError(`${err.status ?? ''} ${err.message}`.trim());
    } finally {
      setLoading(false);
    }
  }

  async function cancel() {
    setError(null);
    setLoading(true);
    try {
      const result = await api.cancelBooking(booking.booking_id);
      setBooking(result);
      await refreshSeats();
    } catch (err) {
      setError(`${err.status ?? ''} ${err.message}`.trim());
    } finally {
      setLoading(false);
    }
  }

  const bookingStatus = booking?.booking_status || booking?.bookingStatus;
  const canConfirm = bookingStatus === 'PENDING';
  const canCancel = bookingStatus === 'PENDING' || bookingStatus === 'CONFIRMED';

  return (
    <div className="page">
      <section className="panel">
        <h2>Search flights</h2>
        <div className="form-row">
          <label>
            Source
            <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="BOM" />
          </label>
          <label>
            Destination
            <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="DEL" />
          </label>
          <button onClick={loadFlights}>Search</button>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Flight</th>
              <th>Route</th>
              <th>Departs</th>
              <th>Base price</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {flights.map((f) => (
              <tr key={f.flight_id} className={selectedFlight?.flight_id === f.flight_id ? 'row-selected' : ''}>
                <td>{f.flight_number}</td>
                <td>{f.source} → {f.destination}</td>
                <td>{new Date(f.departure_time).toLocaleString()}</td>
                <td>₹{f.base_price}</td>
                <td><button onClick={() => selectFlight(f)}>View seats</button></td>
              </tr>
            ))}
            {flights.length === 0 && (
              <tr><td colSpan="5" className="empty">No flights found.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {selectedFlight && (
        <section className="panel">
          <h2>Seat map — {selectedFlight.flight_number}</h2>

          <div className="form-row">
            <label>
              Passenger ID
              <input value={passengerId} onChange={(e) => setPassengerId(e.target.value)} style={{ width: 80 }} />
            </label>
            <span className="hint">Seed data has passengers 1–5. Create more via the backend's POST /api/passengers.</span>
          </div>

          <SeatGrid seats={seats} selected={selectedSeats} onToggle={toggleSeat} />

          {error && <p className="error">{error}</p>}

          <div className="form-row">
            <span>Selected: {selectedSeats.join(', ') || 'none'}</span>
            <button disabled={selectedSeats.length === 0 || loading} onClick={lockSeats}>
              Lock seat(s)
            </button>
          </div>
        </section>
      )}

      {booking && (
        <section className="panel booking-card">
          <h2>
            Booking #{booking.booking_id} <StatusBadge status={bookingStatus} />
          </h2>
          <p>
            Seats: {(booking.seats || []).map((s) => s.seat_number).join(', ')} · Total: ₹{booking.total_amount}
          </p>
          {booking.payment && <p>Payment: <StatusBadge status={booking.payment.status} /></p>}

          <div className="form-row">
            <button disabled={!canConfirm || loading} onClick={() => confirm('SUCCESS')}>
              Confirm (force payment success)
            </button>
            <button disabled={!canConfirm || loading} onClick={() => confirm('FAILED')}>
              Confirm (force payment failure)
            </button>
            <button disabled={!canConfirm || loading} onClick={() => confirm(undefined)}>
              Confirm (random ~90%)
            </button>
            <button disabled={!canCancel || loading} onClick={cancel}>
              Cancel booking
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
