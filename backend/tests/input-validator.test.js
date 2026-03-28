'use strict';

const { validate } = require('../src/modules/validator/input-validator');
const { ValidationError } = require('../src/middleware/errors');

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const TOMORROW = tomorrow.toISOString().slice(0, 10);
const TODAY = new Date().toISOString().slice(0, 10);
const YESTERDAY = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

const valid = { origin: 'SGN', destination: 'HAN', departureDate: TOMORROW, adults: 1 };

describe('Input Validator', () => {
  test('valid intent does not throw', () => {
    expect(() => validate(valid)).not.toThrow();
  });

  test('today is valid', () => {
    expect(() => validate({ ...valid, departureDate: TODAY })).not.toThrow();
  });

  test('adults = 9 is valid', () => {
    expect(() => validate({ ...valid, adults: 9 })).not.toThrow();
  });

  test('origin === destination throws', () => {
    expect(() => validate({ ...valid, destination: 'SGN' }))
      .toThrow('Nơi đi và nơi đến không được giống nhau.');
  });

  test('past date throws', () => {
    expect(() => validate({ ...valid, departureDate: YESTERDAY }))
      .toThrow('Ngày khởi hành phải là ngày hôm nay hoặc trong tương lai.');
  });

  test('bad date format throws', () => {
    expect(() => validate({ ...valid, departureDate: '10/04/2026' }))
      .toThrow('Định dạng ngày không hợp lệ.');
  });

  test('lowercase IATA origin throws', () => {
    expect(() => validate({ ...valid, origin: 'sgn' }))
      .toThrow('Mã sân bay không hợp lệ.');
  });

  test('2-char IATA throws', () => {
    expect(() => validate({ ...valid, destination: 'SG' }))
      .toThrow('Mã sân bay không hợp lệ.');
  });

  test('adults = 0 throws', () => {
    expect(() => validate({ ...valid, adults: 0 }))
      .toThrow('Số hành khách phải ít nhất là 1.');
  });

  test('adults = 10 throws', () => {
    expect(() => validate({ ...valid, adults: 10 }))
      .toThrow('Amadeus hỗ trợ tối đa 9 hành khách.');
  });

  test('throws ValidationError instances', () => {
    expect(() => validate({ ...valid, destination: 'SGN' }))
      .toThrow(ValidationError);
  });

  test('origin !== destination checked before date (throw order)', () => {
    expect(() => validate({ ...valid, destination: 'SGN', departureDate: YESTERDAY }))
      .toThrow('Nơi đi và nơi đến không được giống nhau.');
  });
});
