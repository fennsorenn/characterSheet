import { describe, it, expect } from 'vitest';
import { applyNumberEdit, clampValue } from './numberEdit.js';

describe('applyNumberEdit', () => {
  it('applies a signed delta relative to the current value', () => {
    expect(applyNumberEdit(10, '+4')).toBe(14);
    expect(applyNumberEdit(10, '-3')).toBe(7);
  });

  it('sets an absolute value for a plain number', () => {
    expect(applyNumberEdit(10, '18')).toBe(18);
    expect(applyNumberEdit(10, '0')).toBe(0);
  });

  it('returns null for empty or invalid input (leaves value unchanged)', () => {
    expect(applyNumberEdit(10, '')).toBeNull();
    expect(applyNumberEdit(10, '   ')).toBeNull();
    expect(applyNumberEdit(10, 'abc')).toBeNull();
  });

  it('does not double-apply on a re-commit with cleared input', () => {
    // Enter applies the delta, then blur commits '' which must be a no-op.
    const afterEnter = applyNumberEdit(10, '+4');
    expect(afterEnter).toBe(14);
    expect(applyNumberEdit(afterEnter!, '')).toBeNull();
  });
});

describe('clampValue', () => {
  it('bounds within min/max', () => {
    expect(clampValue(40, 1, 30)).toBe(30);
    expect(clampValue(0, 1, 30)).toBe(1);
    expect(clampValue(15, 1, 30)).toBe(15);
  });
});
