'use strict';

const airports = require('../../data/airports.json');

// Build lookup Map: normalized_alias → IATA_CODE
const aliasMap = new Map();
for (const [code, aliases] of Object.entries(airports)) {
  for (const alias of aliases) {
    aliasMap.set(alias, code);
  }
  // Also map the code itself (lowercase)
  aliasMap.set(code.toLowerCase(), code);
}

/**
 * Normalize a raw location string:
 * lowercase + strip Vietnamese diacritics + trim extra whitespace
 */
function normalize(raw) {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/\u0111/g, 'd')         // đ → d
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Map a raw location string to an IATA airport code.
 * Returns the IATA code (e.g. "SGN") or null if not found.
 *
 * @param {string} raw - City name or IATA code from NLP Parser
 * @returns {string|null}
 */
function mapToIATA(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const key = normalize(raw);
  return aliasMap.get(key) || null;
}

module.exports = { mapToIATA, normalize };
