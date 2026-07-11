import { describe, it, expect } from 'vitest';
import { composeCatalog } from './compose.js';
import { parseOverlay } from './overlay.js';
import { emptyCatalog } from './catalog.js';
import type { Catalog } from './catalog.js';

function baseCatalog(): Catalog {
  const c = emptyCatalog('PHB-dataset');
  c.entries.class = [{ name: 'Fighter', source: 'PHB' }];
  c.entries.spell = [{ name: 'Fireball', source: 'PHB', _classes: [], _subclasses: [] }];
  c.classData.subclass = [{ name: 'Champion', source: 'PHB', className: 'Fighter' }];
  for (const k of Object.keys(c.counts) as (keyof typeof c.counts)[]) {
    c.counts[k] = c.entries[k].length;
  }
  return c;
}

const UA = {
  subclass: [{ name: 'Psi Warrior', source: 'XUA', className: 'Fighter' }],
  subclassFeature: [{ name: 'Psionic Power', source: 'XUA', className: 'Fighter' }],
  spell: [{ name: 'Mind Sliver', source: 'XUA', level: 0 }]
};

describe('composeCatalog', () => {
  it('returns the base unchanged when there are no overlays', () => {
    const base = baseCatalog();
    expect(composeCatalog(base, [])).toBe(base);
  });

  it('appends overlay entries after base entries', () => {
    const base = baseCatalog();
    const overlay = parseOverlay(UA, 'XUA', 'UA Psion');
    const composed = composeCatalog(base, [overlay]);
    expect(composed.entries.spell.map((s) => s.name)).toEqual(['Fireball', 'Mind Sliver']);
    expect(composed.counts.spell).toBe(2);
  });

  it('merges overlay classData (subclasses + features)', () => {
    const composed = composeCatalog(baseCatalog(), [parseOverlay(UA, 'XUA', 'UA Psion')]);
    expect(composed.classData.subclass.map((s) => s.name)).toEqual(['Champion', 'Psi Warrior']);
    expect(composed.classData.subclassFeature.map((f) => f.name)).toEqual(['Psionic Power']);
  });

  it('does not mutate the base catalog', () => {
    const base = baseCatalog();
    composeCatalog(base, [parseOverlay(UA, 'XUA', 'UA Psion')]);
    expect(base.entries.spell.map((s) => s.name)).toEqual(['Fireball']);
    expect(base.classData.subclass.map((s) => s.name)).toEqual(['Champion']);
  });

  it('layers multiple overlays in order and tags the version', () => {
    const base = baseCatalog();
    const a = parseOverlay({ feat: [{ name: 'A', source: 'X1' }] }, 'X1');
    const b = parseOverlay({ feat: [{ name: 'B', source: 'X2' }] }, 'X2');
    const composed = composeCatalog(base, [a, b]);
    expect(composed.entries.feat.map((f) => f.name)).toEqual(['A', 'B']);
    expect(composed.version).toContain('X1+X2');
  });
});
