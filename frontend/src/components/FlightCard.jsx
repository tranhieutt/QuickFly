import React from 'react';

const vndFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
});

function stopsLabel(stops) {
  if (stops === 0) return 'Bay thẳng';
  if (stops === 1) return '1 điểm dừng';
  return `${stops} điểm dừng`;
}

export default function FlightCard({ offer, onSelect }) {
  const hasUrl = Boolean(offer.bookingUrl);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-gray-800 text-sm">{offer.airline}</span>
        <span className="text-blue-600 font-bold text-base">
          {vndFormatter.format(offer.price)}
        </span>
      </div>

      <div className="text-gray-600 text-sm mb-3">
        <span className="font-medium text-gray-800">{offer.departure}</span>
        {' → '}
        <span className="font-medium text-gray-800">{offer.arrival}</span>
        <span className="mx-2 text-gray-400">·</span>
        <span>{offer.duration}</span>
        <span className="mx-2 text-gray-400">·</span>
        <span
          className={
            offer.stops === 0 ? 'text-green-600 font-medium' : 'text-orange-500'
          }
        >
          {stopsLabel(offer.stops)}
        </span>
      </div>

      <button
        onClick={() => onSelect(offer.bookingUrl)}
        disabled={!hasUrl}
        title={!hasUrl ? 'Không có link đặt vé trực tiếp' : undefined}
        className={
          'w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ' +
          (hasUrl
            ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed')
        }
      >
        {hasUrl ? 'Chọn chuyến này' : 'Không có link đặt vé trực tiếp'}
      </button>
    </div>
  );
}
