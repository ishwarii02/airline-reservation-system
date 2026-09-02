-- =========================================================
-- 04_analytics_queries.sql
-- Standalone analytics queries you can run in psql to
-- demonstrate reporting on top of the normalized schema.
-- =========================================================

-- 1. Seat occupancy % per flight
SELECT
    f.flight_id,
    f.flight_number,
    f.source,
    f.destination,
    COUNT(fs.flight_seat_id)                                   AS total_seats,
    COUNT(*) FILTER (WHERE fs.status = 'BOOKED')                AS booked_seats,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE fs.status = 'BOOKED')
        / NULLIF(COUNT(fs.flight_seat_id), 0), 2
    )                                                            AS occupancy_pct
FROM flight f
JOIN flight_seat fs ON fs.flight_id = f.flight_id
GROUP BY f.flight_id, f.flight_number, f.source, f.destination
ORDER BY occupancy_pct DESC;

-- 2. Revenue per flight (only counting successful payments)
SELECT
    f.flight_id,
    f.flight_number,
    COALESCE(SUM(p.amount), 0) AS confirmed_revenue
FROM flight f
LEFT JOIN booking b  ON b.flight_id = f.flight_id AND b.booking_status = 'CONFIRMED'
LEFT JOIN payment p  ON p.booking_id = b.booking_id AND p.status = 'SUCCESS'
GROUP BY f.flight_id, f.flight_number
ORDER BY confirmed_revenue DESC;

-- 3. Revenue by seat class, across the whole system
SELECT
    s.seat_class,
    COUNT(*)            AS seats_sold,
    SUM(bs.price_at_booking) AS revenue
FROM booking_seat bs
JOIN booking b       ON b.booking_id = bs.booking_id AND b.booking_status = 'CONFIRMED'
JOIN flight_seat fs  ON fs.flight_seat_id = bs.flight_seat_id
JOIN seat s          ON s.seat_id = fs.seat_id
GROUP BY s.seat_class
ORDER BY revenue DESC;

-- 4. Most popular routes (by confirmed bookings)
SELECT
    f.source,
    f.destination,
    COUNT(*) AS confirmed_bookings
FROM booking b
JOIN flight f ON f.flight_id = b.flight_id
WHERE b.booking_status = 'CONFIRMED'
GROUP BY f.source, f.destination
ORDER BY confirmed_bookings DESC;

-- 5. Currently locked seats older than the lock timeout
-- (candidates for the lock-cleanup job to release)
SELECT flight_seat_id, flight_id, seat_id, locked_at
FROM flight_seat
WHERE status = 'LOCKED'
  AND locked_at < now() - interval '5 minutes';

-- 6. Booking funnel: how many bookings end in each status
SELECT booking_status, COUNT(*) AS bookings
FROM booking
GROUP BY booking_status
ORDER BY bookings DESC;

-- 7. A passenger's full booking history (parameterize :passenger_id)
SELECT * FROM v_booking_summary
WHERE passenger_id = 1
ORDER BY created_at DESC;
