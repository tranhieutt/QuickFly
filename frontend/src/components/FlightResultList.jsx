import React from 'react';
import FlightCard from './FlightCard';

export default function FlightResultList({ offers }) {
  if (!offers || offers.length === 0) return null;

  function handleSelect(url) {
    if (!url) return;
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // Popup blocked — nothing to do, button stays visible
    }
  }

  return (
    <div className="flex flex-col gap-3 w-full max-w-sm">
      {offers.map((offer) => (
        <FlightCard key={offer.id} offer={offer} onSelect={handleSelect} />
      ))}
    </div>
  );
}
