import { describe, it, expect } from 'vitest';
import { slugify, uniqueSlug, uniqueName } from './characters.js';

describe('slugify', () => {
  it('reduces a name to url-safe words', () => {
    expect(slugify('Gandalf the Grey')).toBe('gandalf-the-grey');
    expect(slugify("  Théo's Axe!!  ")).toBe('th-o-s-axe');
  });

  it('never returns an empty slug', () => {
    expect(slugify('!!!')).toBe('character');
  });
});

describe('uniqueSlug', () => {
  it('keeps the plain slug when it is free', () => {
    expect(uniqueSlug('Bran', ['aragorn'])).toBe('bran');
  });

  it('suffixes past every collision', () => {
    expect(uniqueSlug('Bran', ['bran'])).toBe('bran-2');
    expect(uniqueSlug('Bran', ['bran', 'bran-2', 'bran-3'])).toBe('bran-4');
  });
});

describe('uniqueName', () => {
  it('leaves a free name alone', () => {
    expect(uniqueName('Bran', ['Aragorn'])).toBe('Bran');
  });

  // A copy landing in a library that already has one has to read differently,
  // or the two rows are indistinguishable in the list.
  it('numbers a name that is taken', () => {
    expect(uniqueName('Bran', ['Bran'])).toBe('Bran (2)');
    expect(uniqueName('Bran', ['Bran', 'Bran (2)'])).toBe('Bran (3)');
  });

  it('is exact, not fuzzy', () => {
    expect(uniqueName('Bran', ['Brandon', 'bran'])).toBe('Bran');
  });
});
