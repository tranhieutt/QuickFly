'use strict';

const { FilterError } = require('../../middleware/errors');
const { config } = require('../../config');

const TIME_WINDOWS = {
  morning: { start: '06:00', end: '11:59' },
  afternoon: { start: '12:00', end: '17:59' },
};

const FILTER_MESSAGES = {
  morning: 'Không tìm thấy chuyến bay buổi sáng. Bạn có muốn thử giờ khác không?',
  afternoon: 'Không tìm thấy chuyến bay buổi chiều. Bạn có muốn thử giờ khác không?',
};

/**
 * Apply filters to a list of FlightOffers and return top MAX_RESULTS.
 * The list must already be sorted by price ascending.
 *
 * @param {FlightOffer[]} offers
 * @param {{ timeOfDay: 'morning'|'afternoon'|null, stops: 'direct'|'any' }} filters
 * @returns {FlightOffer[]}
 * @throws {FilterError} if no offers remain after filtering
 */
function applyFilters(offers, filters) {
  if (!offers || offers.length === 0) {
    throw new FilterError('Không tìm thấy chuyến bay phù hợp.');
  }

  let result = offers;
  const { timeOfDay } = filters || {};

  if (timeOfDay && TIME_WINDOWS[timeOfDay]) {
    const { start, end } = TIME_WINDOWS[timeOfDay];
    result = result.filter((o) => {
      const dep = o.departure;
      return dep >= start && dep <= end;
    });

    if (result.length === 0) {
      const msg =
        FILTER_MESSAGES[timeOfDay] || 'Không tìm thấy chuyến bay phù hợp.';
      throw new FilterError(msg);
    }
  }

  return result.slice(0, config.maxResults);
}

module.exports = { applyFilters };
