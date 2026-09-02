import { useState } from 'react';
import { BASE_URL } from './api';
import BookFlight from './pages/BookFlight.jsx';
import BookingHistory from './pages/BookingHistory.jsx';
import ConcurrencyDemo from './pages/ConcurrencyDemo.jsx';
import Analytics from './pages/Analytics.jsx';

const TABS = [
  { id: 'book', label: 'Book a flight' },
  { id: 'history', label: 'Booking history' },
  { id: 'concurrency', label: 'Concurrency test' },
  { id: 'analytics', label: 'Analytics' },
];

export default function App() {
  const [tab, setTab] = useState('book');

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Airline Reservation System</h1>
          <p className="subtitle">
            Demo client for the booking API. Backend: <code>{BASE_URL}</code>
          </p>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? 'tab active' : 'tab'}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="app-main">
        {tab === 'book' && <BookFlight />}
        {tab === 'history' && <BookingHistory />}
        {tab === 'concurrency' && <ConcurrencyDemo />}
        {tab === 'analytics' && <Analytics />}
      </main>
    </div>
  );
}
