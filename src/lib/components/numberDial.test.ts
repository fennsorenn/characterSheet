import { describe, it, expect } from 'vitest';
import {
  canBeNegative,
  setDigit,
  digitCells,
  digitsFor,
  flipSign,
  formatDelta,
  placeOf,
  stepDigit
} from './numberDial.js';

describe('digitsFor', () => {
  it('sizes a field by what it can hold', () => {
    expect(digitsFor(1, 30)).toBe(2); // an ability score
    expect(digitsFor(0, 9)).toBe(1); // a spell slot count
    expect(digitsFor(1, 20)).toBe(2); // a class level
  });

  // The floor says nothing about how big the value gets — sizing a resource
  // with `min: 0` by its minimum would give it a single digit.
  it('falls back when the ceiling is open', () => {
    expect(digitsFor(0, Infinity)).toBe(2);
    expect(digitsFor(0, Infinity, 3)).toBe(3);
    expect(digitsFor(-Infinity, Infinity)).toBe(2);
  });

  it('leaves room for a large negative floor', () => {
    expect(digitsFor(-500, 10)).toBe(3);
  });
});

describe('digitCells', () => {
  it('pads to the field width, most significant first', () => {
    expect(digitCells(7, 3)).toEqual([0, 0, 7]);
    expect(digitCells(142, 3)).toEqual([1, 4, 2]);
  });

  it('shows magnitude — the sign is its own cell, not a digit', () => {
    expect(digitCells(-42, 3)).toEqual([0, 4, 2]);
  });

  it('keeps the last digits when a value outgrows the field', () => {
    expect(digitCells(1234, 2)).toEqual([3, 4]);
  });
});

describe('stepDigit', () => {
  it('adds the place value, carrying rather than cycling', () => {
    expect(stepDigit(19, placeOf(1, 2), 1)).toBe(20); // the ones of 19 → 20
    expect(stepDigit(99, 10, 1)).toBe(109); // tens of 99 → 109, not 9
    expect(stepDigit(142, 100, -1)).toBe(42);
  });

  it('stays inside the bounds', () => {
    expect(stepDigit(28, 10, 1, 1, 30)).toBe(30);
    expect(stepDigit(3, 10, -1, 0, 30)).toBe(0);
  });

  it('places digits by position, largest first', () => {
    expect(placeOf(0, 3)).toBe(100);
    expect(placeOf(2, 3)).toBe(1);
  });
});

// Typing is not stepping: a digit typed into a cell is that digit.
describe('setDigit', () => {
  it('replaces the digit at that place, leaving the rest', () => {
    expect(setDigit(142, 100, 9)).toBe(942);
    expect(setDigit(142, 10, 0)).toBe(102);
    expect(setDigit(142, 1, 7)).toBe(147);
  });

  it('does not carry — a 9 in the tens is 9x, not "+90"', () => {
    expect(setDigit(99, 10, 1)).toBe(19);
    expect(setDigit(5, 100, 3)).toBe(305);
  });

  it('still answers to the bounds', () => {
    expect(setDigit(10, 10, 9, 1, 30)).toBe(30); // 90 asked for, 30 is the ceiling
    expect(setDigit(10, 10, 0, 1, 30)).toBe(1); // 0 asked for, 1 is the floor
  });

  it('keeps the sign it was given', () => {
    expect(setDigit(-12, 1, 5, -99, 99)).toBe(-15);
  });
});

describe('sign', () => {
  it('offers a sign only where a negative is legal', () => {
    expect(canBeNegative(0)).toBe(false);
    expect(canBeNegative(-5)).toBe(true);
  });

  it('flips within the bounds', () => {
    expect(flipSign(5, -10, 10)).toBe(-5);
    expect(flipSign(-5, -10, 10)).toBe(5);
    expect(flipSign(5, 0, 10)).toBe(0); // nowhere negative to go
    expect(flipSign(0)).toBe(0);
  });
});

describe('formatDelta', () => {
  it('says what the edit would change', () => {
    expect(formatDelta(20, 25)).toBe('+5');
    expect(formatDelta(20, 13)).toBe('−7');
    expect(formatDelta(20, 20)).toBe('±0');
  });
});
