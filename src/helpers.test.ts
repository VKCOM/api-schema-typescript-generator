import { areQuotesNeededForProperty } from './helpers';

test('areQuotesNeededForProperty', () => {
  expect(areQuotesNeededForProperty('user_id')).toBe(false);
  expect(areQuotesNeededForProperty('uuid4')).toBe(false);
  expect(areQuotesNeededForProperty('_foo')).toBe(false);

  expect(areQuotesNeededForProperty('4uuid')).toBe(true);
  expect(areQuotesNeededForProperty('user-id')).toBe(true);
  expect(areQuotesNeededForProperty('user&id')).toBe(true);
  expect(areQuotesNeededForProperty('идентификатор')).toBe(true);
});
