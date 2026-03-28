'use strict';

const airlines = require('../../data/airlines.json');

/**
 * Build a booking URL for a given IATA carrier code.
 * Returns the airline's homepage URL or null if not found.
 *
 * @param {string} carrierCode - IATA carrier code (e.g. "VN")
 * @returns {string|null}
 */
function buildBookingUrl(carrierCode) {
  if (!carrierCode || typeof carrierCode !== 'string') return null;
  return airlines[carrierCode]?.url || null;
}

module.exports = { buildBookingUrl };
