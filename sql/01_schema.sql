-- =========================================================
-- Airline Reservation & Concurrent Seat-Locking System
-- 01_schema.sql : Core tables (3NF, no derived/duplicated data)
-- =========================================================

DROP TABLE IF EXISTS payment CASCADE;
DROP TABLE IF EXISTS booking_seat CASCADE;
DROP TABLE IF EXISTS booking CASCADE;
DROP TABLE IF EXISTS flight_seat CASCADE;
DROP TABLE IF EXISTS seat CASCADE;
DROP TABLE IF EXISTS flight CASCADE;
DROP TABLE IF EXISTS passenger CASCADE;

-- ---------------------------------------------------------
-- PASSENGER
-- ---------------------------------------------------------
CREATE TABLE passenger (
    passenger_id    SERIAL PRIMARY KEY,
    full_name       VARCHAR(120)  NOT NULL,
    email           VARCHAR(150)  NOT NULL UNIQUE,
    phone           VARCHAR(20)   NOT NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------
-- FLIGHT
-- ---------------------------------------------------------
CREATE TABLE flight (
    flight_id       SERIAL PRIMARY KEY,
    flight_number   VARCHAR(10)   NOT NULL,
    source          VARCHAR(3)    NOT NULL,   -- IATA airport code, e.g. BOM
    destination     VARCHAR(3)    NOT NULL,   -- IATA airport code, e.g. DEL
    departure_time  TIMESTAMPTZ   NOT NULL,
    arrival_time    TIMESTAMPTZ   NOT NULL,
    base_price      NUMERIC(10,2) NOT NULL CHECK (base_price > 0),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT chk_flight_route        CHECK (source <> destination),
    CONSTRAINT chk_flight_times        CHECK (arrival_time > departure_time),
    CONSTRAINT uq_flight_number_date   UNIQUE (flight_number, departure_time)
);

CREATE INDEX idx_flight_route_date ON flight (source, destination, departure_time);

-- ---------------------------------------------------------
-- SEAT  (physical seat map, reusable across flights of the
-- same aircraft configuration — kept generic/simple on purpose)
-- ---------------------------------------------------------
CREATE TABLE seat (
    seat_id         SERIAL PRIMARY KEY,
    seat_number     VARCHAR(5)    NOT NULL UNIQUE,   -- e.g. 12A
    seat_class      VARCHAR(10)   NOT NULL,

    CONSTRAINT chk_seat_class CHECK (seat_class IN ('ECONOMY', 'BUSINESS', 'FIRST'))
);

-- ---------------------------------------------------------
-- FLIGHT_SEAT  (associative entity: inventory of a seat on a
-- specific flight, with its own status and price)
-- This is the row that gets locked during booking.
-- ---------------------------------------------------------
CREATE TABLE flight_seat (
    flight_seat_id  SERIAL PRIMARY KEY,
    flight_id       INTEGER       NOT NULL REFERENCES flight(flight_id) ON DELETE CASCADE,
    seat_id         INTEGER       NOT NULL REFERENCES seat(seat_id)     ON DELETE RESTRICT,
    status          VARCHAR(10)   NOT NULL DEFAULT 'AVAILABLE',
    price           NUMERIC(10,2) NOT NULL CHECK (price > 0),
    locked_at       TIMESTAMPTZ,          -- set when status becomes LOCKED
    version         INTEGER       NOT NULL DEFAULT 0,  -- audit/debug aid, not used for locking

    CONSTRAINT uq_flight_seat        UNIQUE (flight_id, seat_id),
    CONSTRAINT chk_flight_seat_status CHECK (status IN ('AVAILABLE', 'LOCKED', 'BOOKED'))
);

CREATE INDEX idx_flight_seat_flight_status ON flight_seat (flight_id, status);

-- ---------------------------------------------------------
-- BOOKING  (one passenger, one flight, one or more seats)
-- ---------------------------------------------------------
CREATE TABLE booking (
    booking_id      SERIAL PRIMARY KEY,
    passenger_id    INTEGER       NOT NULL REFERENCES passenger(passenger_id) ON DELETE RESTRICT,
    flight_id       INTEGER       NOT NULL REFERENCES flight(flight_id)       ON DELETE RESTRICT,
    booking_status  VARCHAR(10)   NOT NULL DEFAULT 'PENDING',
    total_amount    NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT chk_booking_status CHECK (booking_status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'FAILED'))
);

CREATE INDEX idx_booking_passenger ON booking (passenger_id);
CREATE INDEX idx_booking_flight    ON booking (flight_id);
CREATE INDEX idx_booking_status    ON booking (booking_status);

-- ---------------------------------------------------------
-- BOOKING_SEAT  (associative entity: which flight_seats belong
-- to which booking; price is snapshotted at booking time so
-- later price changes on flight_seat never rewrite history)
-- ---------------------------------------------------------
CREATE TABLE booking_seat (
    booking_seat_id   SERIAL PRIMARY KEY,
    booking_id        INTEGER       NOT NULL REFERENCES booking(booking_id)         ON DELETE CASCADE,
    flight_seat_id    INTEGER       NOT NULL REFERENCES flight_seat(flight_seat_id) ON DELETE RESTRICT,
    price_at_booking  NUMERIC(10,2) NOT NULL CHECK (price_at_booking > 0),

    CONSTRAINT uq_booking_flight_seat UNIQUE (booking_id, flight_seat_id)
);

CREATE INDEX idx_booking_seat_booking     ON booking_seat (booking_id);
CREATE INDEX idx_booking_seat_flight_seat ON booking_seat (flight_seat_id);

-- ---------------------------------------------------------
-- PAYMENT  (one payment record per booking; simulated gateway)
-- ---------------------------------------------------------
CREATE TABLE payment (
    payment_id      SERIAL PRIMARY KEY,
    booking_id      INTEGER       NOT NULL UNIQUE REFERENCES booking(booking_id) ON DELETE CASCADE,
    amount          NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    status          VARCHAR(10)   NOT NULL,
    payment_method  VARCHAR(20)   NOT NULL DEFAULT 'SIMULATED_CARD',
    transaction_ref VARCHAR(40)   NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT chk_payment_status CHECK (status IN ('SUCCESS', 'FAILED', 'REFUNDED'))
);

CREATE INDEX idx_payment_booking ON payment (booking_id);
