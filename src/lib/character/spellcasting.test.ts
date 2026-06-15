import { describe, it, expect } from 'vitest';
import { spellcastingLimits, evalPreparedFormula } from './spellcasting.js';
import { createCharacter } from './schema.js';
import { emptyCatalog, type Catalog } from '../data/catalog.js';
import type { Ability } from './abilities.js';

function catalog(): Catalog {
  const c = emptyCatalog('test');
  c.entries.class = [
    {
      name: 'Cleric',
      source: 'PHB',
      spellcastingAbility: 'wis',
      cantripProgression: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5],
      preparedSpells: '<$level$> + <$wis_mod$>'
    },
    {
      name: 'Bard',
      source: 'PHB',
      spellcastingAbility: 'cha',
      cantripProgression: [2, 2, 2, 3, 3],
      spellsKnownProgression: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14]
    },
    { name: 'Fighter', source: 'PHB' } // non-caster
  ] as never;
  return c;
}

const mods: Record<Ability, number> = { str: 0, dex: 0, con: 0, int: 0, wis: 3, cha: 2 };
const mod = (a: Ability) => mods[a];

describe('evalPreparedFormula', () => {
  it('sums additive tokens with the ability modifier and level', () => {
    expect(evalPreparedFormula('<$level$> + <$wis_mod$>', 5, mod, 3)).toBe(8); // 5 + 3
  });
  it('handles half-level (rounded) tokens and a minimum of 1', () => {
    expect(evalPreparedFormula('<$level_half_rounded_up$> + <$cha_mod$>', 5, mod, 2)).toBe(5); // ceil(5/2)=3 +2
    expect(evalPreparedFormula('<$level$>', 0, mod, 2)).toBe(1); // min 1
  });
});

describe('spellcastingLimits', () => {
  it('computes cantrips and the prepared limit for a prepared caster', () => {
    const c = createCharacter({ classes: [{ name: 'Cleric', source: 'PHB', level: 5 }] });
    expect(spellcastingLimits(c, catalog(), mod, 3)).toEqual({ cantrips: 4, prepared: 8, known: null });
  });

  it('computes the known limit for a known caster', () => {
    const c = createCharacter({ classes: [{ name: 'Bard', source: 'PHB', level: 3 }] });
    expect(spellcastingLimits(c, catalog(), mod, 2)).toEqual({ cantrips: 2, prepared: null, known: 6 });
  });

  it('returns nulls for a non-caster', () => {
    const c = createCharacter({ classes: [{ name: 'Fighter', source: 'PHB', level: 5 }] });
    expect(spellcastingLimits(c, catalog(), mod, 3)).toEqual({ cantrips: null, prepared: null, known: null });
  });

  it('sums across a multiclass of a prepared and a known caster', () => {
    const c = createCharacter({
      classes: [
        { name: 'Cleric', source: 'PHB', level: 4 },
        { name: 'Bard', source: 'PHB', level: 2 }
      ]
    });
    // cantrips 4 (Cleric L4) + 2 (Bard L2) = 6; prepared 4+3=7; known 5 (Bard L2)
    expect(spellcastingLimits(c, catalog(), mod, 3)).toEqual({ cantrips: 6, prepared: 7, known: 5 });
  });
});
