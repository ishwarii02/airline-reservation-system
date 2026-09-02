# Frontend (demo client)

A small React + Vite client for the booking API in `../src`. It's a thin UI
over the REST endpoints documented in the root `README.md` — no business
logic lives here; every rule (double-booking rejection, payment rollback,
lock expiry) is enforced by the backend and its Postgres transactions, not
by this app.

It exists to make the project demoable: search flights, pick seats on a
seat map, lock → confirm → cancel a booking, and — the important one — fire
a batch of real concurrent requests at the same seat from the browser and
watch the database let exactly one of them win.

## Pages

- **Book a flight** — search, seat map, lock/confirm/cancel flow
- **Booking history** — bookings for a given passenger ID, with cancel
- **Concurrency test** — fires N simultaneous `POST /api/bookings/lock`
  requests at one seat against the live backend (the browser-based
  equivalent of `node tests/concurrency-test.js`)
- **Analytics** — occupancy and revenue, plus a manual trigger for the
  expired-lock cleanup job

## Running it

The backend must already be set up and running (see the root `README.md`,
steps 1–7) before this is useful.

```bash
cd frontend
npm install
cp .env.example .env      # only needed if your backend isn't on :3000
npm run dev
# -> http://localhost:5173
```

## Notes

- There's no login — pass a passenger ID directly (seed data has IDs 1–5)
  or create one via the backend's `POST /api/passengers`.
- The concurrency test needs the target seat to be `AVAILABLE`. Reset the
  seed data between runs with `../scripts/reset-db.sh`.
- `npm run build` produces a static `dist/` bundle if you want to host this
  separately from the API.
