import { describe, it, expect } from 'vitest';
import { casterClasses, assignSpellCounts, evalPreparedFormula, type CasterClass } from './spellcasting.js';
import { createCharacter } from './schema.js';
import { emptyCatalog, type Catalog } from '../data/catalog.js';
import type { Ability } from './abilities.js';

function catalog(): Catalog {
  const c = emptyCatalog('test');
  c.entries.class = [
    { name: 'Cleric', source: 'PHB', spellcastingAbility: 'wis', cantripProgression: [3, 3, 3, 4, 4], preparedSpells: '<$level$> + <$wis_mod$>' },
    { name: 'Wizard', source: 'PHB', spellcastingAbility: 'int', cantripProgression: [3, 3, 3, 4, 4], preparedSpells: '<$level$> + <$int_mod$>', spellsKnownProgressionFixed: [6, 2, 2, 2, 2] },
    { name: 'Paladin', source: 'PHB', spellcastingAbility: 'cha', preparedSpells: '<$level$> / 2 + <$cha_mod$>' },
    { name: 'Bard', source: 'PHB', spellcastingAbility: 'cha', cantripProgression: [2, 2, 2, 3, 3], spellsKnownProgression: [4, 5, 6, 7, 8] },
    // 2024 Cleric: a fixed preparedSpellsProgression array instead of a formula.
    { name: 'Cleric', source: 'XPHB', spellcastingAbility: 'wis', cantripProgression: [3, 3, 3, 4, 4], preparedSpellsProgression: [4, 5, 6, 7, 9] },
    { name: 'Fighter', source: 'PHB' }
  ] as never;
  return c;
}

const mods: Record<Ability, number> = { str: 0, dex: 0, con: 0, int: 3, wis: 3, cha: 4 };
const mod = (a: Ability) => mods[a];

describe('evalPreparedFormula', () => {
  it('sums tokens', () => expect(evalPreparedFormula('<$level$> + <$wis_mod$>', 5, mod, 3)).toBe(8));
  it('handles division (half-casters), rounding down', () => {
    expect(evalPreparedFormula('<$level$> / 2 + <$cha_mod$>', 5, mod, 2)).toBe(6); // floor(5/2)=2 + 4
    expect(evalPreparedFormula('<$level$> / 2 + <$cha_mod$>', 1, mod, 2)).toBe(4); // 0 + 4
  });
});

describe('casterClasses', () => {
  it('classifies prepared vs known casters with their limits', () => {
    const c = createCharacter({
      classes: [
        { name: 'Cleric', source: 'PHB', level: 5 },
        { name: 'Bard', source: 'PHB', level: 3 },
        { name: 'Paladin', source: 'PHB', level: 6 },
        { name: 'Fighter', source: 'PHB', level: 2 }
      ]
    });
    const cc = casterClasses(c, catalog(), mod, 3);
    expect(cc.map((c) => `${c.name}:${c.kind}:${c.cantrips}:${c.spells}`)).toEqual([
      'Cleric:prepared:4:8', // cantrips[5]=4, prepared 5+3
      'Bard:known:2:6', // cantrips[3]=2, known[3]=6
      'Paladin:prepared:null:7' // no cantrips, floor(6/2)=3 + 4
    ]); // Fighter excluded (no spellcasting)
  });

  it('reads a 2024 prepared caster limit from preparedSpellsProgression', () => {
    const c = createCharacter({ classes: [{ name: 'Cleric', source: 'XPHB', level: 5 }] });
    const [cleric] = casterClasses(c, catalog(), mod, 3);
    expect(cleric.kind).toBe('prepared');
    expect(cleric.cantrips).toBe(4); // cantripProgression[5]
    expect(cleric.spells).toBe(9); // preparedSpellsProgression[5] = 9 (not null)
  });

  it('gives a Wizard a prepared limit and a summed spellbook total', () => {
    const c = createCharacter({ classes: [{ name: 'Wizard', source: 'PHB', level: 5 }] });
    const [wiz] = casterClasses(c, catalog(), mod, 3);
    expect(wiz.kind).toBe('prepared');
    expect(wiz.cantrips).toBe(4); // cantripProgression[5]
    expect(wiz.spells).toBe(8); // prepared = level 5 + int mod 3
    expect(wiz.book).toBe(14); // sum of [6,2,2,2,2] = 6 + 2*(5-1)
  });

  it('does not give non-spellbook prepared casters a book', () => {
    const c = createCharacter({ classes: [{ name: 'Cleric', source: 'PHB', level: 5 }] });
    expect(casterClasses(c, catalog(), mod, 3)[0].book).toBeNull();
  });
});

describe('assignSpellCounts', () => {
  const cleric: CasterClass = { key: 'cleric|phb', name: 'Cleric', source: 'PHB', level: 5, ability: 'wis', kind: 'prepared', cantrips: 4, spells: 8, book: null };
  const wizard: CasterClass = { key: 'wizard|phb', name: 'Wizard', source: 'PHB', level: 5, ability: 'int', kind: 'prepared', cantrips: 4, spells: 8, book: 14 };
  const bard: CasterClass = { key: 'bard|phb', name: 'Bard', source: 'PHB', level: 5, ability: 'cha', kind: 'known', cantrips: 3, spells: 8, book: null };

  it('counts prepared spells per class and frees a prepared caster’s unprepared spells', () => {
    const counts = assignSpellCounts(
      [cleric],
      [
        { level: 0, classes: ['Cleric'], prepared: false },
        { level: 1, classes: ['Cleric'], prepared: true },
        { level: 2, classes: ['Cleric'], prepared: true },
        { level: 3, classes: ['Cleric'], prepared: false } // known but not prepared → free
      ]
    );
    expect(counts[0]).toMatchObject({ cantripsUsed: 1, spellsUsed: 2 });
  });

  it('keeps two same-name classes (PHB + XPHB Cleric) as separate keyed buckets', () => {
    const phb: CasterClass = { ...cleric, key: 'cleric|phb', source: 'PHB', spells: 5 };
    const xphb: CasterClass = { ...cleric, key: 'cleric|xphb', source: 'XPHB', spells: 9 };
    const counts = assignSpellCounts(
      [phb, xphb],
      [
        { level: 1, classes: ['Cleric'], prepared: true },
        { level: 2, classes: ['Cleric'], prepared: true }
      ]
    );
    // Two distinct rows (unique keys), not one merged 'Cleric' bucket.
    expect(counts).toHaveLength(2);
    expect(new Set(counts.map((c) => c.key)).size).toBe(2);
    // Both prepared spells assigned; total across the two Clerics is 2 (no double-count).
    expect(counts.reduce((n, c) => n + c.spellsUsed, 0)).toBe(2);
  });

  it('assigns a dual-list prepared spell to the class with more open slots', () => {
    // Cleric already near full; the shared prepared spell should go to Wizard.
    const counts = assignSpellCounts(
      [{ ...cleric, spells: 2 }, { ...wizard, spells: 8 }],
      [
        { level: 1, classes: ['Cleric'], prepared: true },
        { level: 1, classes: ['Cleric'], prepared: true },
        { level: 2, classes: ['Cleric', 'Wizard'], prepared: true } // fits both → Wizard (more room)
      ]
    );
    const byName = Object.fromEntries(counts.map((c) => [c.name, c.spellsUsed]));
    expect(byName).toEqual({ Cleric: 2, Wizard: 1 });
  });

  it('a spell known by a known caster consumes a slot; most-constrained assigned first', () => {
    const counts = assignSpellCounts(
      [cleric, bard],
      [
        { level: 1, classes: ['Bard'], prepared: false }, // Bard-only known → consumes Bard
        { level: 1, classes: ['Cleric', 'Bard'], prepared: false } // free on Cleric → not on Bard
      ]
    );
    const byName = Object.fromEntries(counts.map((c) => [c.name, c.spellsUsed]));
    expect(byName).toEqual({ Cleric: 0, Bard: 1 });
  });

  it('counts every leveled wizard spell toward its book regardless of prepared status, and may exceed the book limit without flagging', () => {
    // Book limit 3, but 5 leveled wizard spells (mix prepared/unprepared) recorded.
    const counts = assignSpellCounts(
      [{ ...wizard, spells: 8, book: 3 }],
      [
        { level: 0, classes: ['Wizard'], prepared: false }, // cantrip — not a book spell
        { level: 1, classes: ['Wizard'], prepared: true },
        { level: 1, classes: ['Wizard'], prepared: true },
        { level: 2, classes: ['Wizard'], prepared: false }, // known but unprepared → still in book
        { level: 3, classes: ['Wizard'], prepared: false },
        { level: 4, classes: ['Wizard'], prepared: false }
      ]
    );
    expect(counts[0].bookLimit).toBe(3);
    expect(counts[0].bookUsed).toBe(5); // all 5 leveled spells, cantrip excluded
    expect(counts[0].bookUsed).toBeGreaterThan(counts[0].bookLimit!); // not clamped/flagged
    // Prepared slots still tally only prepared (or known-only) leveled spells.
    expect(counts[0].spellsUsed).toBe(2);
  });
});
