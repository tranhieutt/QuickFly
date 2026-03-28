'use strict';

const { ValidationError } = require('../../middleware/errors');

const IATA_REGEX = /^[A-Z]{3}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ADULTS = 9;

/**
 * Validate a ParsedIntent for business-rule correctness.
 * Throws ValidationError on the first rule violation.
 * Returns void if valid.
 *
 * @param {{ origin: string, destination: string, departureDate: string, adults: number }} intent
 */
function validate(intent) {
  const { origin, destination, departureDate, adults } = intent;

  // 1. origin !== destination
  if (origin === destination) {
    throw new ValidationError('Nơi đi và nơi đến không được giống nhau.');
  }

  // 2. departureDate format
  if (!DATE_REGEX.test(departureDate)) {
    throw new ValidationError('Định dạng ngày không hợp lệ.');
  }

  // 3. departureDate >= today (UTC)
  const today = new Date().toISOString().slice(0, 10);
  if (departureDate < today) {
    throw new ValidationError('Ngày khởi hành phải là ngày hôm nay hoặc trong tương lai.');
  }

  // 4. IATA format: origin
  if (!IATA_REGEX.test(origin)) {
    throw new ValidationError('Mã sân bay không hợp lệ.');
  }

  // 5. IATA format: destination
  if (!IATA_REGEX.test(destination)) {
    throw new ValidationError('Mã sân bay không hợp lệ.');
  }

  // 6. adults >= 1
  if (adults < 1) {
    throw new ValidationError('Số hành khách phải ít nhất là 1.');
  }

  // 7. adults <= MAX_ADULTS
  if (adults > MAX_ADULTS) {
    throw new ValidationError('Amadeus hỗ trợ tối đa 9 hành khách.');
  }
}

module.exports = { validate };
