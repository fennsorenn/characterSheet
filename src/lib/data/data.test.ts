import { describe, it, expect } from 'vitest';
import { expandVariants } from './variants.js';
import { parseCatalog } from './parse.js';
import { SearchIndex } from './search.js';
import { readerFromFiles } from './zip.js';
import { strToU8 } from 'fflate';
import type { DataReader, NamedEntry } from './catalog.js';

/** Build a DataReader from a plain object of `path -> json` fixtures. */
function readerFromObjects(tree: Record<string, unknown>): DataReader {
  const files: Record<string, Uint8Array> = {};
  for (const [path, value] of Object.entries(tree)) {
    files[`data/${path}`] = strToU8(JSON.stringify(value));
  }
  return readerFromFiles(files);
}

describe('expandVariants', () => {
  const base: NamedEntry[] = [
    { name: 'Longsword', source: 'PHB', type: 'M', weapon: true, dmg1: '1d8' },
    { name: 'Shield', source: 'PHB', type: 'S', armor: true },
    { name: 'Dagger', source: 'PHB', type: 'M', weapon: true, dmg1: '1d4' }
  ];

  it('generates a variant for each qualifying base item', () => {
    const variants = expandVariants(base, [
      {
        name: '+1 Weapon',
        requires: [{ weapon: true }],
        inherits: { namePrefix: '+1 ', source: 'DMG', bonusWeapon: '+1' }
      }
    ]);
    expect(variants.map((v) => v.name).sort()).toEqual(['+1 Dagger', '+1 Longsword']);
    expect(variants[0].source).toBe('DMG');
    expect(variants[0]._baseName).toBe('Longsword');
  });

  it('honours excludes', () => {
    const variants = expandVariants(base, [
      {
        requires: [{ weapon: true }],
        excludes: { name: 'Dagger' },
        inherits: { namePrefix: '+2 ' }
      }
    ]);
    expect(variants.map((v) => v.name)).toEqual(['+2 Longsword']);
  });

  it('resolves {=field} templates against the merged item', () => {
    const [variant] = expandVariants(base.slice(0, 1), [
      {
        requires: [{ weapon: true }],
        inherits: {
          namePrefix: '+1 ',
          bonusWeapon: '+1',
          entries: ['You gain a {=bonusWeapon} bonus with this {=name}.']
        }
      }
    ]);
    expect(variant.entries).toEqual(['You gain a +1 bonus with this +1 Longsword.']);
  });
});

describe('parseCatalog', () => {
  const reader = readerFromObjects({
    'feats.json': { feat: [{ name: 'Alert', source: 'PHB' }] },
    'spells/index.json': { PHB: 'spells-phb.json', XGE: 'spells-xge.json' },
    'spells/spells-phb.json': { spell: [{ name: 'Fireball', source: 'PHB', level: 3 }] },
    'spells/spells-xge.json': { spell: [{ name: 'Toll the Dead', source: 'XGE', level: 0 }] },
    'items.json': { item: [{ name: 'Bag of Holding', source: 'DMG' }] },
    'items-base.json': { baseitem: [{ name: 'Club', source: 'PHB', type: 'M', weapon: true }] },
    'magicvariants.json': {
      magicvariant: [
        { requires: [{ weapon: true }], inherits: { namePrefix: '+1 ', source: 'DMG' } }
      ]
    }
  });
  const catalog = parseCatalog(reader, 'test');

  it('reads single-file categories', () => {
    expect(catalog.entries.feat).toHaveLength(1);
    expect(catalog.entries.feat[0].name).toBe('Alert');
  });

  it('follows index.json across multiple source files', () => {
    expect(catalog.counts.spell).toBe(2);
    expect(catalog.entries.spell.map((s) => s.name)).toContain('Toll the Dead');
  });

  it('combines base items, magic items, and expanded variants', () => {
    const names = catalog.entries.item.map((i) => i.name);
    expect(names).toContain('Club'); // base
    expect(names).toContain('Bag of Holding'); // premade magic
    expect(names).toContain('+1 Club'); // generated variant
  });

  it('skips missing files without throwing', () => {
    const sparse = parseCatalog(readerFromObjects({}), 'empty');
    expect(sparse.counts.spell).toBe(0);
    expect(sparse.entries.item).toEqual([]);
  });
});

describe('SearchIndex', () => {
  const catalog = parseCatalog(
    readerFromObjects({
      'spells/index.json': { PHB: 'a.json' },
      'spells/spells-phb.json': undefined,
      'a.json': undefined
    }),
    'test'
  );
  // Hand-build entries to control ranking expectations.
  catalog.entries.spell = [
    { name: 'Fire Bolt', source: 'PHB' },
    { name: 'Fireball', source: 'PHB' },
    { name: 'Wall of Fire', source: 'PHB' },
    { name: 'Cure Wounds', source: 'PHB' }
  ];
  catalog.entries.item = [{ name: 'Fire Opal', source: 'DMG' }];
  const index = new SearchIndex(catalog);

  it('ranks prefix matches above word-boundary above substring', () => {
    const hits = index.search('fire');
    const names = hits.map((h) => h.entry.name);
    // 'Fire Bolt'/'Fireball' (prefix) before 'Wall of Fire' (word boundary).
    expect(names.indexOf('Fireball')).toBeLessThan(names.indexOf('Wall of Fire'));
    expect(names).not.toContain('Cure Wounds');
  });

  it('filters by category', () => {
    const hits = index.search('fire', { categories: ['item'] });
    expect(hits.map((h) => h.entry.name)).toEqual(['Fire Opal']);
  });

  it('returns nothing for an empty query', () => {
    expect(index.search('')).toEqual([]);
  });
});
