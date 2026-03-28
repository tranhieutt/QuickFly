'use strict';

const { config } = require('../../config');
const { AmadeusError } = require('../../middleware/errors');
const { buildBookingUrl } = require('../redirect/redirect-handler');
const airlines = require('../../data/airlines.json');

const DUFFEL_BASE = 'https://api.duffel.com';
const DUFFEL_VERSION = 'v2';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.duffel.timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

function duffelHeaders() {
  return {
    Authorization: `Bearer ${config.duffel.token}`,
    'Content-Type': 'application/json',
    'Duffel-Version': DUFFEL_VERSION,
  };
}

function parseDuration(iso) {
  // PT2H10M → "2h10m"
  if (!iso) return 'N/A';
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return 'N/A';
  const h = match[1] ? `${match[1]}h` : '';
  const m = match[2] ? `${match[2]}m` : '';
  return h + m || 'N/A';
}

function parseTime(dateTimeStr) {
  // "2026-04-10T07:00:00" → "07:00"
  if (!dateTimeStr) return 'N/A';
  const match = dateTimeStr.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : 'N/A';
}

function normalizeOffer(offer) {
  const slice = offer.slices[0];
  const segments = slice.segments;
  const first = segments[0];
  const last = segments[segments.length - 1];
  const carrierCode = first.marketing_carrier.iata_code;
  const airlineName =
    airlines[carrierCode]?.name || first.marketing_carrier.name || carrierCode;
  const bookingUrl = buildBookingUrl(carrierCode);
  const usdPrice = parseFloat(offer.total_amount);
  const price = Math.round(usdPrice * config.vndExchangeRate);

  return {
    id: offer.id,
    airline: airlineName,
    price,
    currency: 'VND',
    departure: parseTime(first.departing_at),
    arrival: parseTime(last.arriving_at),
    duration: parseDuration(slice.duration),
    stops: segments.length - 1,
    bookingUrl,
  };
}

// ─── Main search function ─────────────────────────────────────────────────────

/**
 * Search for flights using the Duffel API.
 *
 * @param {ParsedIntent} intent
 * @returns {Promise<FlightOffer[]>} sorted by price ascending
 * @throws {AmadeusError} (reusing error class — maps to same user-facing message)
 */
async function searchFlights(intent) {
  // Build Duffel offer request body
  const body = {
    data: {
      slices: [
        {
          origin: intent.origin,
          destination: intent.destination,
          departure_date: intent.departureDate,
        },
      ],
      passengers: Array.from({ length: intent.adults }, () => ({
        type: 'adult',
      })),
      cabin_class: 'economy',
      ...(intent.filters?.stops === 'direct' && { max_connections: 0 }),
    },
  };

  let res;
  try {
    res = await fetchWithTimeout(`${DUFFEL_BASE}/air/offer_requests?return_offers=true`, {
      method: 'POST',
      headers: duffelHeaders(),
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new AmadeusError(`Duffel request failed: ${err.message}`);
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const detail = errBody?.errors?.[0]?.message || `HTTP ${res.status}`;
    throw new AmadeusError(`Duffel error: ${detail}`);
  }

  const data = await res.json();
  const offers = data.data?.offers || [];

  if (offers.length === 0) {
    throw new AmadeusError('Không tìm thấy chuyến bay phù hợp.');
  }

  // Normalize, filter out bad data, sort by price
  const normalized = offers
    .slice(0, config.duffel.maxResults)
    .map((offer) => {
      try {
        return normalizeOffer(offer);
      } catch {
        return null;
      }
    })
    .filter((o) => o !== null && o.price > 0);

  if (normalized.length === 0) {
    throw new AmadeusError('Không tìm thấy chuyến bay phù hợp.');
  }

  normalized.sort((a, b) => a.price - b.price);
  return normalized;
}

module.exports = { searchFlights };
