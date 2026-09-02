-- =========================================================
-- 03_seed.sql
-- Deterministic seed data for local development / testing.
-- Safe to re-run against a freshly created schema.
-- =========================================================

-- ---------------------------------------------------------
-- Passengers
-- ---------------------------------------------------------
INSERT INTO passenger (full_name, email, phone) VALUES
    ('Ishwari Kulkarni', 'ishwari@example.com',  '9000000001'),
    ('Aarav Sharma',     'aarav@example.com',    '9000000002'),
    ('Meera Iyer',       'meera@example.com',    '9000000003'),
    ('Rohan Desai',      'rohan@example.com',    '9000000004'),
    ('Sneha Patil',      'sneha@example.com',    '9000000005');

-- ---------------------------------------------------------
-- Flights (a small realistic network, all in the future)
-- ---------------------------------------------------------
INSERT INTO flight (flight_number, source, destination, departure_time, arrival_time, base_price) VALUES
    ('AI101', 'BOM', 'DEL', now() + interval '2 days'  + interval '6 hours', now() + interval '2 days' + interval '8 hours 10 minutes', 4500.00),
    ('AI202', 'DEL', 'BLR', now() + interval '3 days'  + interval '9 hours', now() + interval '3 days' + interval '11 hours 40 minutes', 5200.00),
    ('AI303', 'BOM', 'BLR', now() + interval '4 days'  + interval '5 hours', now() + interval '4 days' + interval '6 hours 45 minutes', 3900.00);

-- ---------------------------------------------------------
-- Seat map: a small single-aisle layout re-used by every flight
--   Rows 1-2  -> BUSINESS (A, B, C, D)
--   Rows 3-7  -> ECONOMY  (A, B, C, D)
-- 8 rows x 4 seats = 32 seats total
-- ---------------------------------------------------------
INSERT INTO seat (seat_number, seat_class)
SELECT
    row_no || letter                                        AS seat_number,
    CASE WHEN row_no <= 2 THEN 'BUSINESS' ELSE 'ECONOMY' END AS seat_class
FROM generate_series(1, 7) AS row_no
CROSS JOIN unnest(ARRAY['A', 'B', 'C', 'D']) AS letter
ORDER BY row_no, letter;

-- ---------------------------------------------------------
-- flight_seat: give every flight the full seat map, priced off
-- the flight's base_price with a business-class multiplier.
-- ---------------------------------------------------------
INSERT INTO flight_seat (flight_id, seat_id, status, price)
SELECT
    f.flight_id,
    s.seat_id,
    'AVAILABLE',
    CASE WHEN s.seat_class = 'BUSINESS'
         THEN ROUND(f.base_price * 2.2, 2)
         ELSE f.base_price
    END
FROM flight f
CROSS JOIN seat s;
