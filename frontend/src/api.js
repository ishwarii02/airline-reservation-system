const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function request(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    const message = data.error || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  return data;
}

export const api = {
  searchFlights: (params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v))
    ).toString();
    return request('GET', `/api/flights${query ? `?${query}` : ''}`);
  },
  getFlightSeats: (flightId) => request('GET', `/api/flights/${flightId}/seats`),
  lockSeats: (body) => request('POST', '/api/bookings/lock', body),
  confirmBooking: (bookingId, body) => request('POST', `/api/bookings/${bookingId}/confirm`, body ?? {}),
  cancelBooking: (bookingId) => request('POST', `/api/bookings/${bookingId}/cancel`, {}),
  getBooking: (bookingId) => request('GET', `/api/bookings/${bookingId}`),
  createPassenger: (body) => request('POST', '/api/passengers', body),
  getBookingHistory: (passengerId) => request('GET', `/api/passengers/${passengerId}/bookings`),
  getOccupancy: () => request('GET', '/api/analytics/occupancy'),
  getRevenue: () => request('GET', '/api/analytics/revenue'),
  releaseExpiredLocks: () => request('POST', '/api/analytics/release-expired-locks', {}),
};

export { BASE_URL };
