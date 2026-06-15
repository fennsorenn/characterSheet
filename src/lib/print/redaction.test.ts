import { describe, it, expect } from 'vitest';
import { redactionClasses } from './redaction.js';

const none = { frequent: false, occasional: false };

describe('redactionClasses', () => {
  it('prints all values at level "all"', () => {
    expect(redactionClasses('all', none)).toEqual([]);
  });

  it('omits frequent, then occasional, cumulatively', () => {
    expect(redactionClasses('omit-frequent', none)).toEqual(['hide-frequent']);
    expect(redactionClasses('omit-occasional', none)).toEqual([
      'hide-frequent',
      'hide-occasional'
    ]);
  });

  it('blanks everything at level "blank"', () => {
    expect(redactionClasses('blank', none)).toEqual(['hide-all']);
  });

  it('honours custom toggles independently', () => {
    expect(redactionClasses('custom', { frequent: true, occasional: false })).toEqual([
      'hide-frequent'
    ]);
    expect(redactionClasses('custom', { frequent: false, occasional: true })).toEqual([
      'hide-occasional'
    ]);
    expect(redactionClasses('custom', { frequent: true, occasional: true })).toEqual([
      'hide-frequent',
      'hide-occasional'
    ]);
  });
});
