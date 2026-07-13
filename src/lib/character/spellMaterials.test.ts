import { describe, it, expect } from 'vitest';
import { spellMaterial, displayedMaterial } from './spellMaterials.js';
import type { NamedEntry } from '../data/catalog.js';

const spell = (m: unknown): NamedEntry => ({ name: 'X', source: 'PHB', components: { m } }) as NamedEntry;

describe('spellMaterial', () => {
  it('returns null when there is no material component', () => {
    expect(spellMaterial(spell(undefined))).toBeNull();
    expect(spellMaterial({ name: 'X', source: 'PHB' } as NamedEntry)).toBeNull();
  });

  it('handles a plain string component', () => {
    expect(spellMaterial(spell('a bit of fleece'))).toEqual({ text: 'a bit of fleece', costGp: 0, consumed: false });
  });

  it('converts cost from copper to gold and reads consume', () => {
    expect(spellMaterial(spell({ text: 'a diamond worth 300 gp', cost: 30000, consume: true }))).toEqual({
      text: 'a diamond worth 300 gp',
      costGp: 300,
      consumed: true
    });
  });

  it('treats "optional" consume as consumed', () => {
    expect(spellMaterial(spell({ text: 'ruby dust', cost: 5000, consume: 'optional' }))?.consumed).toBe(true);
  });
});

describe('displayedMaterial', () => {
  const costlyConsumed = spell({ text: 'a diamond worth 300 gp', cost: 30000, consume: true });
  const costlyReusable = spell({ text: 'a jade circle worth 1,500 gp', cost: 150000 });
  const free = spell('a pinch of sand');

  it('shows nothing when off', () => {
    expect(displayedMaterial(costlyConsumed, 'off')).toBeNull();
  });

  it('always mode shows any costly material, not free ones', () => {
    expect(displayedMaterial(costlyReusable, 'always')?.costGp).toBe(1500);
    expect(displayedMaterial(free, 'always')).toBeNull();
  });

  it('consumed mode requires the material be used up', () => {
    expect(displayedMaterial(costlyConsumed, 'consumed')?.consumed).toBe(true);
    expect(displayedMaterial(costlyReusable, 'consumed')).toBeNull();
  });
});
