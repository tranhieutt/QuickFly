'use strict';

const { applyFilters } = require('../src/modules/filter/filter-engine');
const { FilterError } = require('../src/middleware/errors');

// Mock config before requiring module
jest.mock('../src/config', () => ({
  config: { maxResults: 3, amadeus: { env: 'test' } },
}));

function makeOffer(id, departure, price = 500000) {
  return { id, airline: 'Test Air', price, currency: 'VND', departure, arrival: '10:00', duration: '2h', stops: 0, bookingUrl: null };
}

const offers = [
  makeOffer('1', '07:00', 300000),
  makeOffer('2', '09:30', 400000),
  makeOffer('3', '13:00', 200000),
  makeOffer('4', '15:45', 250000),
  makeOffer('5', '06:00', 350000),
];

describe('Filter Engine', () => {
  test('no filter → returns top 3 cheapest (pre-sorted)', () => {
    const sorted = [...offers].sort((a, b) => a.price - b.price);
    const result = applyFilters(sorted, { timeOfDay: null, stops: 'any' });
    expect(result).toHaveLength(3);
    expect(result[0].price).toBe(200000);
  });

  test('morning filter → only 06:00–11:59', () => {
    const sorted = [...offers].sort((a, b) => a.price - b.price);
    const result = applyFilters(sorted, { timeOfDay: 'morning', stops: 'any' });
    result.forEach((o) => {
      expect(o.departure >= '06:00' && o.departure <= '11:59').toBe(true);
    });
  });

  test('afternoon filter → only 12:00–17:59', () => {
    const sorted = [...offers].sort((a, b) => a.price - b.price);
    const result = applyFilters(sorted, { timeOfDay: 'afternoon', stops: 'any' });
    result.forEach((o) => {
      expect(o.departure >= '12:00' && o.departure <= '17:59').toBe(true);
    });
  });

  test('boundary: 06:00 passes morning', () => {
    const result = applyFilters([makeOffer('x', '06:00')], { timeOfDay: 'morning' });
    expect(result).toHaveLength(1);
  });

  test('boundary: 11:59 passes morning', () => {
    const result = applyFilters([makeOffer('x', '11:59')], { timeOfDay: 'morning' });
    expect(result).toHaveLength(1);
  });

  test('boundary: 05:59 does NOT pass morning', () => {
    expect(() => applyFilters([makeOffer('x', '05:59')], { timeOfDay: 'morning' }))
      .toThrow(FilterError);
  });

  test('empty offers throws FilterError', () => {
    expect(() => applyFilters([], { timeOfDay: null })).toThrow(FilterError);
  });

  test('filter yields 0 results throws FilterError with message', () => {
    const eveningOnly = [makeOffer('1', '20:00')];
    expect(() => applyFilters(eveningOnly, { timeOfDay: 'morning' }))
      .toThrow('Không tìm thấy chuyến bay buổi sáng');
  });

  test('< 3 results after filter → returns what is available', () => {
    const oneOffer = [makeOffer('1', '08:00')];
    const result = applyFilters(oneOffer, { timeOfDay: 'morning' });
    expect(result).toHaveLength(1);
  });
});
