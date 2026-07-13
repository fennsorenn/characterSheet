import { describe, it, expect } from 'vitest';
import { dedupeBySource } from './dedupe.js';
import type { NamedEntry } from './catalog.js';

const e = (name: string, source: string): NamedEntry => ({ name, source }) as NamedEntry;

describe('dedupeBySource', () => {
  it('returns the list unchanged when no primary source is set', () => {
    const list = [e('Mace', 'PHB'), e('Mace', 'XPHB')];
    expect(dedupeBySource(list, null)).toBe(list);
    expect(dedupeBySource(list, '')).toBe(list);
  });

  it('hides non-primary duplicates when a primary version exists', () => {
    const list = [e('Mace', 'PHB'), e('Mace', 'XPHB'), e('Dagger', 'PHB')];
    const out = dedupeBySource(list, 'XPHB');
    expect(out.map((x) => `${x.name}|${x.source}`)).toEqual(['Mace|XPHB', 'Dagger|PHB']);
  });

  it('is case-insensitive on both source and name', () => {
    const list = [e('mace', 'phb'), e('Mace', 'XPHB')];
    const out = dedupeBySource(list, 'xphb');
    expect(out).toEqual([e('Mace', 'XPHB')]);
  });

  it('keeps all copies of a name absent from the primary source', () => {
    const list = [e('Shield', 'PHB'), e('Shield', 'TCE')];
    // No XPHB shield exists, so neither is hidden.
    expect(dedupeBySource(list, 'XPHB')).toEqual(list);
  });

  it('preserves original order', () => {
    const list = [e('A', 'PHB'), e('B', 'XPHB'), e('A', 'XPHB'), e('C', 'PHB')];
    const out = dedupeBySource(list, 'XPHB');
    expect(out.map((x) => x.name)).toEqual(['B', 'A', 'C']);
  });
});
