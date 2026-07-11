import { describe, it, expect } from 'vitest';
import { createCharacter } from './schema.js';
import type { Character, NoteNode } from './schema.js';

/**
 * `createCharacter` is the single hydration point on load (see the character
 * store). If it fails to copy a field from its `partial`, that field is silently
 * dropped on every reload — as happened to `notes`. This round-trips a fully
 * populated document and asserts every serializable field survives.
 */

describe('createCharacter round-trip', () => {
  const notes: NoteNode[] = [
    { id: 'f1', name: 'Folder', children: [{ id: 'd1', name: 'Doc', content: '# hi' }] },
    { id: 'd2', name: 'Loose', content: 'text' }
  ];

  const full: Character = {
    schemaVersion: 1,
    id: 'char-1',
    name: 'Tessa',
    abilities: { str: 8, dex: 14, con: 12, int: 16, wis: 10, cha: 13 },
    classes: [{ name: 'Cleric', source: 'XPHB', level: 5 }],
    race: { name: 'Human', source: 'PHB' },
    background: { name: 'Acolyte', source: 'PHB' },
    feats: [{ name: 'Tough', source: 'PHB' }],
    saveProficiencies: ['wis'],
    skillProficiencies: { insight: 'proficient' },
    spellcasting: { ability: 'wis' },
    hp: { max: 30, current: 25, temp: 3 },
    acBase: 14,
    inventory: [{ name: 'Mace', source: 'PHB', quantity: 1, equipped: true }],
    spells: [{ name: 'Bless', source: 'PHB' }],
    modifiers: [{ target: 'ac', source: 'Ring', value: 1 }],
    resources: [{ id: 'r1', name: 'Channel Divinity', max: 2, used: 1, recharge: 'short' }],
    featureResourceUsed: { 'channel-divinity': 1 },
    spellSlots: [{ max: 4, expended: 1 }],
    spellSlotsAuto: false,
    pactSlotsExpended: 0,
    buffs: [{ id: 'b1', name: 'Bless', modifiers: [], active: true }],
    conditions: ['blinded'],
    exhaustion: 1,
    hitDice: [{ die: 8, max: 5, used: 2 }],
    spellChoices: { 'slot|k': { name: 'Guidance', source: 'PHB' } },
    featureOptions: { 'opt|k': '1' },
    abilityChoices: { 'asi|k': { str: 1 } },
    grantChoices: { 'g|k': ['history'] },
    optionalChoices: { 'o|k': { name: 'X', source: 'PHB' } },
    featChoices: { 'slot|k': { name: 'Tough', source: 'PHB' } },
    featureMeta: { 'Feature|PHB': { hidden: true } },
    variantChoices: { 'blessed strikes|uacfv|8': true },
    notes
  };

  it('preserves every populated field', () => {
    const out = createCharacter(full);
    // Compare key-by-key so a newly-added-but-not-copied field is easy to spot.
    for (const key of Object.keys(full) as (keyof Character)[]) {
      expect(out[key], `field "${key}" was dropped by createCharacter`).toEqual(full[key]);
    }
  });

  it('preserves the notes tree specifically (regression)', () => {
    expect(createCharacter({ notes }).notes).toEqual(notes);
  });

  it('leaves notes undefined for a fresh character', () => {
    expect(createCharacter().notes).toBeUndefined();
  });
});
