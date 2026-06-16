import type { Catalog } from '../data/catalog.js';
import type { Character } from './schema.js';

/**
 * Spell slots available at the character's level.
 *
 * Leveled slots follow the standard table by *spellcaster level*: full casters
 * add their level, half-casters (Paladin/Ranger) add half, the Artificer adds
 * half rounded up, and a single-class half-caster uses its own (round-up) table.
 * Warlock Pact Magic is tracked separately (short-rest slots of a single level).
 *
 * Tables are SRD game mechanics (facts), computed here rather than parsed from
 * the user's data so slots are correct regardless of which books are loaded.
 */

export interface SpellSlotInfo {
  /** Slot counts for levels 1-9 (index 0 = level 1). */
  slots: number[];
  /** Warlock Pact Magic, when the character has warlock levels. */
  pact: { count: number; level: number } | null;
}

const ZERO = () => [0, 0, 0, 0, 0, 0, 0, 0, 0];

// Standard / multiclass full-caster slot table, indexed by spellcaster level.
const FULL: number[][] = [
  ZERO(), // 0
  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1]
];

const lc = (s: string) => s.toLowerCase();
const findClass = (catalog: Catalog, ref: { name: string; source: string }) =>
  catalog.entries.class.find((c) => lc(c.name) === lc(ref.name) && lc(String(c.source)) === lc(ref.source));
const clampLevel = (l: number) => Math.max(0, Math.min(20, l));

/** Multiclass spellcaster-level contribution for a caster progression. */
function contribution(prog: string, level: number): number {
  if (prog === 'full') return level;
  if (prog === '1/2') return Math.floor(level / 2);
  if (prog === 'artificer') return Math.ceil(level / 2);
  if (prog === '1/3') return Math.floor(level / 3);
  return 0;
}

/** Single-class slot row (half-casters round up; Paladin/Ranger get none at 1). */
function singleSlots(prog: string, level: number): number[] {
  if (prog === 'full') return FULL[clampLevel(level)].slice();
  if (prog === 'artificer') return FULL[clampLevel(Math.ceil(level / 2))].slice();
  if (prog === '1/2') return level < 2 ? ZERO() : FULL[clampLevel(Math.ceil(level / 2))].slice();
  if (prog === '1/3') return level < 3 ? ZERO() : FULL[clampLevel(Math.ceil(level / 3))].slice();
  return ZERO();
}

/** Warlock Pact Magic: a number of slots, all of one level, by warlock level. */
function pactMagic(level: number): { count: number; level: number } {
  const slotLevel = Math.min(5, Math.ceil(level / 2));
  const count = level >= 17 ? 4 : level >= 11 ? 3 : level >= 2 ? 2 : 1;
  return { count, level: slotLevel };
}

export function spellSlotInfo(character: Character, catalog: Catalog): SpellSlotInfo {
  const slotCasters: { prog: string; level: number }[] = [];
  let warlockLevel = 0;
  for (const cls of character.classes) {
    const c = findClass(catalog, cls);
    const prog = c?.casterProgression ? String(c.casterProgression) : '';
    if (!prog) continue;
    if (prog === 'pact') warlockLevel += cls.level;
    else slotCasters.push({ prog, level: cls.level });
  }

  let slots = ZERO();
  if (slotCasters.length === 1) {
    slots = singleSlots(slotCasters[0].prog, slotCasters[0].level);
  } else if (slotCasters.length > 1) {
    const effLevel = slotCasters.reduce((n, c) => n + contribution(c.prog, c.level), 0);
    slots = FULL[clampLevel(effLevel)].slice();
  }

  return { slots, pact: warlockLevel > 0 ? pactMagic(warlockLevel) : null };
}
