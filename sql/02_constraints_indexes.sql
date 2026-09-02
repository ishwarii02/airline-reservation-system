-- =========================================================
-- 02_constraints_indexes.sql
-- Trigger to keep booking.updated_at current, plus a couple
-- of convenience views used by the read endpoints/analytics.
-- =========================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_booking_updated_at ON booking;
CREATE TRIGGER trg_booking_updated_at
BEFORE UPDATE ON booking
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------
-- View: seat availability per flight (used by GET /flights/:id/seats)
-- ---------------------------------------------------------
CREATE OR REPLACE VIEW v_flight_seat_availability AS
SELECT
    fs.flight_seat_id,
    fs.flight_id,
    s.seat_id,
    s.seat_number,
    s.seat_class,
    fs.price,
    fs.status
FROM flight_seat fs
JOIN seat s ON s.seat_id = fs.seat_id;

-- ---------------------------------------------------------
-- View: confirmed booking summary (used by booking history)
-- ---------------------------------------------------------
CREATE OR REPLACE VIEW v_booking_summary AS
SELECT
    b.booking_id,
    b.passenger_id,
    p.full_name        AS passenger_name,
    b.flight_id,
    f.flight_number,
    f.source,
    f.destination,
    f.departure_time,
    b.booking_status,
    b.total_amount,
    b.created_at,
    array_agg(s.seat_number ORDER BY s.seat_number) AS seat_numbers
FROM booking b
JOIN passenger p       ON p.passenger_id = b.passenger_id
JOIN flight f           ON f.flight_id = b.flight_id
LEFT JOIN booking_seat bs ON bs.booking_id = b.booking_id
LEFT JOIN flight_seat fs  ON fs.flight_seat_id = bs.flight_seat_id
LEFT JOIN seat s          ON s.seat_id = fs.seat_id
GROUP BY b.booking_id, p.full_name, f.flight_number, f.source, f.destination,
         f.departure_time;
