'use strict';

const { mapToIATA } = require('../src/modules/iata/iata-mapper');

describe('IATA Code Mapper', () => {
  test('maps "hcm" → SGN', () => expect(mapToIATA('hcm')).toBe('SGN'));
  test('maps "Hà Nội" → HAN (with diacritics)', () => expect(mapToIATA('Hà Nội')).toBe('HAN'));
  test('maps "sài gòn" → SGN', () => expect(mapToIATA('sài gòn')).toBe('SGN'));
  test('maps "da nang" → DAD', () => expect(mapToIATA('da nang')).toBe('DAD'));
  test('maps uppercase IATA "SGN" → SGN', () => expect(mapToIATA('SGN')).toBe('SGN'));
  test('maps lowercase iata "han" → HAN', () => expect(mapToIATA('han')).toBe('HAN'));
  test('maps "phu quoc" → PQC', () => expect(mapToIATA('phu quoc')).toBe('PQC'));
  test('returns null for unknown city', () => expect(mapToIATA('xyz unknown')).toBeNull());
  test('returns null for empty string', () => expect(mapToIATA('')).toBeNull());
  test('returns null for null input', () => expect(mapToIATA(null)).toBeNull());
});
