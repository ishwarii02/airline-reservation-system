// Groups the flat seat list from GET /api/flights/:id/seats into rows and
// renders it as a clickable grid. AVAILABLE seats are selectable; LOCKED and
// BOOKED are shown but disabled.
export default function SeatGrid({ seats, selected, onToggle }) {
  const rows = {};
  seats.forEach((seat) => {
    const rowNumber = seat.seat_number.match(/\d+/)[0];
    if (!rows[rowNumber]) rows[rowNumber] = [];
    rows[rowNumber].push(seat);
  });

  const rowNumbers = Object.keys(rows).sort((a, b) => Number(a) - Number(b));

  return (
    <div className="seat-grid">
      {rowNumbers.map((rowNumber) => (
        <div className="seat-row" key={rowNumber}>
          <span className="row-label">{rowNumber}</span>
          {rows[rowNumber]
            .sort((a, b) => a.seat_number.localeCompare(b.seat_number))
            .map((seat) => {
              const isSelected = selected.includes(seat.seat_number);
              const isAvailable = seat.status === 'AVAILABLE';
              return (
                <button
                  key={seat.seat_number}
                  className={[
                    'seat',
                    isSelected ? 'seat-selected' : '',
                    !isAvailable ? `seat-${seat.status.toLowerCase()}` : '',
                  ].join(' ')}
                  disabled={!isAvailable}
                  title={`${seat.seat_number} · ${seat.seat_class} · ₹${seat.price} · ${seat.status}`}
                  onClick={() => onToggle(seat.seat_number)}
                >
                  {seat.seat_number}
                </button>
              );
            })}
        </div>
      ))}
      <div className="seat-legend">
        <span><i className="dot dot-available" /> Available</span>
        <span><i className="dot dot-selected" /> Selected</span>
        <span><i className="dot dot-locked" /> Locked</span>
        <span><i className="dot dot-booked" /> Booked</span>
      </div>
    </div>
  );
}
