import { describe, it, expect } from 'vitest';
import {
  SCREEN_CATEGORIES,
  SCREEN_LABELS,
  SCREEN_MAX_WIDTH,
  categoryForWidth,
  isScreenCategory
} from './screen.js';

// The category boundaries must line up with the grid breakpoints in
// LayoutRenderer, so switching templates happens exactly where the grid reflows.
describe('categoryForWidth', () => {
  it('maps widths to categories at the grid breakpoints', () => {
    expect(categoryForWidth(320)).toBe('mobile');
    expect(categoryForWidth(SCREEN_MAX_WIDTH.mobile)).toBe('mobile');
    expect(categoryForWidth(SCREEN_MAX_WIDTH.mobile + 1)).toBe('tablet');
    expect(categoryForWidth(SCREEN_MAX_WIDTH.tablet)).toBe('tablet');
    expect(categoryForWidth(SCREEN_MAX_WIDTH.tablet + 1)).toBe('desktop');
    expect(categoryForWidth(SCREEN_MAX_WIDTH.desktop)).toBe('desktop');
    expect(categoryForWidth(SCREEN_MAX_WIDTH.desktop + 1)).toBe('ultrawide');
    expect(categoryForWidth(3840)).toBe('ultrawide');
  });

  it('covers every category and labels them all', () => {
    const seen = new Set(
      [200, 800, 1400, 2400].map((w) => categoryForWidth(w))
    );
    expect([...seen].sort()).toEqual([...SCREEN_CATEGORIES].sort());
    expect(SCREEN_CATEGORIES.every((c) => !!SCREEN_LABELS[c])).toBe(true);
  });

  it('narrows untrusted strings', () => {
    expect(isScreenCategory('mobile')).toBe(true);
    expect(isScreenCategory('watch')).toBe(false);
    expect(isScreenCategory(undefined)).toBe(false);
  });
});
