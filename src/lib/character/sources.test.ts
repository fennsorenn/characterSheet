import { describe, it, expect } from 'vitest';
import { createCharacter, CUSTOM_SOURCE } from './schema.js';
import {
  referencedSources,
  sourceStatuses,
  missingSources,
  setSourceLink,
  removeSourceLink,
  linkFor
} from './sources.js';

const elli = () =>
  createCharacter({
    name: 'Elli',
    classes: [{ name: 'Wizard', source: 'XPHB', level: 3, hitDie: 6 }],
    race: { name: 'Elf (Fury)', source: 'ObojimaTallGrass' },
    background: { name: 'Apprentice Witch', source: 'ObojimaTallGrass' },
    spells: [
      { name: 'Fire Bolt', source: 'XPHB' },
      { name: 'Jolt', source: 'ObojimaTallGrass' }
    ],
    inventory: [
      { name: 'Dagger', source: 'XPHB', quantity: 2, equipped: true },
      { name: 'Umbrella', source: 'ObojimaTallGrass', quantity: 1, equipped: false },
      { name: 'Hat', source: CUSTOM_SOURCE, quantity: 1, equipped: true }
    ]
  });

describe('referencedSources', () => {
  it('collects every source the document points at, once each', () => {
    // Ordered by first appearance, and race is read before classes.
    expect(referencedSources(elli())).toEqual(['ObojimaTallGrass', 'XPHB']);
  });

  it('ignores the player\'s own entries, which can never be fetched', () => {
    expect(referencedSources(elli())).not.toContain(CUSTOM_SOURCE);
  });

  it('reads refs out of the choice records too, not just the plain lists', () => {
    const c = createCharacter({
      // Pinned: createCharacter seeds a default Fighter/PHB class otherwise.
      classes: [{ name: 'Wizard', source: 'XPHB', level: 1, hitDie: 6 }],
      featChoices: { asi4: { name: 'Alert', source: 'XPHB' } },
      spellChoices: { magicInitiate: { name: 'Guidance', source: 'SomeBrew' } }
    });
    expect(referencedSources(c).sort()).toEqual(['SomeBrew', 'XPHB']);
  });
});

describe('sourceStatuses', () => {
  it('marks loaded sources and counts the refs behind each', () => {
    const s = sourceStatuses(elli(), ['XPHB']);
    const byId = Object.fromEntries(s.map((x) => [x.id, x]));
    expect(byId.XPHB.loaded).toBe(true);
    expect(byId.ObojimaTallGrass.loaded).toBe(false);
    // race + background + spell + item
    expect(byId.ObojimaTallGrass.refCount).toBe(4);
  });

  it('treats source ids case-insensitively, so casing is not a missing source', () => {
    expect(missingSources(elli(), ['xphb', 'obojimatallgrass'])).toEqual([]);
  });

  it('surfaces the stored link on the status', () => {
    const c = setSourceLink(elli(), {
      id: 'ObojimaTallGrass',
      label: 'Obojima',
      url: 'https://example.com/obojima.json'
    });
    const missing = missingSources(c, ['XPHB']);
    expect(missing).toHaveLength(1);
    expect(missing[0].url).toBe('https://example.com/obojima.json');
    expect(missing[0].label).toBe('Obojima');
  });

  it('reports a missing source with no link, rather than hiding it', () => {
    const missing = missingSources(elli(), ['XPHB']);
    expect(missing).toHaveLength(1);
    expect(missing[0].url).toBeUndefined();
  });
});

describe('setSourceLink', () => {
  it('replaces rather than duplicates when the id repeats in another casing', () => {
    let c = setSourceLink(elli(), { id: 'ObojimaTallGrass', url: 'https://a.example/x.json' });
    c = setSourceLink(c, { id: 'obojimatallgrass', url: 'https://b.example/y.json' });
    expect(c.sources).toHaveLength(1);
    expect(linkFor(c, 'OBOJIMATALLGRASS')?.url).toBe('https://b.example/y.json');
  });

  it('does not mutate the document it was given', () => {
    const before = elli();
    setSourceLink(before, { id: 'X', url: 'https://x.example/x.json' });
    expect(before.sources).toBeUndefined();
  });

  it('ignores a link with no url, which would be unusable', () => {
    const c = setSourceLink(elli(), { id: 'X', url: '' });
    expect(c.sources ?? []).toHaveLength(0);
  });
});

describe('removeSourceLink', () => {
  it('drops the link by id, case-insensitively', () => {
    const c = setSourceLink(elli(), { id: 'ObojimaTallGrass', url: 'https://a.example/x.json' });
    expect(removeSourceLink(c, 'obojimatallgrass').sources).toEqual([]);
  });
});
