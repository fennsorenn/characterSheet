import type { Catalog } from '../data/catalog.js';
import type { Character } from './schema.js';
import { ABILITIES, type Ability } from './abilities.js';

/**
 * How many cantrips / prepared / known spells a character's classes grant, for
 * the spell-counter denominators. Pulled from each class's spellcasting data:
 *   cantripProgression   — cantrips known by class level
 *   preparedSpells       — formula for prepared casters (Cleric, Wizard, …)
 *   spellsKnownProgression — spells known by level (Bard, Sorcerer, Ranger, …)
 *
 * Modifiers/levels are summed across caster classes (multiclass), and ability
 * modifiers come from the live graph so ASIs/feats/items are reflected.
 */

export interface SpellcastingLimits {
  /** Cantrips known, or null if no class grants cantrips. */
  cantrips: number | null;
  /** Prepared-spell limit, or null if the character isn't a prepared caster. */
  prepared: number | null;
  /** Spells-known limit, or null if the character isn't a "known" caster. */
  known: number | null;
}

const lc = (s: string) => s.toLowerCase();
const isAbility = (s: string): s is Ability => (ABILITIES as readonly string[]).includes(s);
const findClass = (catalog: Catalog, ref: { name: string; source: string }) =>
  catalog.entries.class.find((c) => lc(c.name) === lc(ref.name) && lc(String(c.source)) === lc(ref.source));

const atLevel = (prog: number[], level: number) => prog[Math.min(Math.max(level, 1), prog.length) - 1] ?? 0;

/**
 * Evaluate a 5etools `preparedSpells` formula like "<$level$> + <$wis_mod$>".
 * Official formulas are additive, so we sum the tokens (min 1).
 */
export function evalPreparedFormula(
  formula: string,
  classLevel: number,
  abilityMod: (a: Ability) => number,
  profBonus: number
): number {
  let total = 0;
  for (const part of formula.split('+')) {
    const t = part.trim();
    const tok = t.match(/^<\$(.+)\$>$/)?.[1];
    if (!tok) {
      const n = Number(t);
      if (!Number.isNaN(n)) total += n;
      continue;
    }
    if (tok === 'level') total += classLevel;
    else if (tok === 'level_half' || tok === 'level_half_rounded_down') total += Math.floor(classLevel / 2);
    else if (tok === 'level_half_rounded_up') total += Math.ceil(classLevel / 2);
    else if (tok === 'prof_bonus') total += profBonus;
    else {
      const abil = tok.match(/^([a-z]{3})_mod$/)?.[1];
      if (abil && isAbility(abil)) total += abilityMod(abil);
    }
  }
  return Math.max(1, total);
}

export function spellcastingLimits(
  character: Character,
  catalog: Catalog,
  abilityMod: (a: Ability) => number,
  profBonus: number
): SpellcastingLimits {
  let cantrips = 0;
  let prepared = 0;
  let known = 0;
  let hasCantrips = false;
  let hasPrepared = false;
  let hasKnown = false;

  for (const cls of character.classes) {
    const c = findClass(catalog, cls);
    if (!c || !c.spellcastingAbility) continue; // not a spellcaster

    const cp = c.cantripProgression;
    if (Array.isArray(cp)) {
      hasCantrips = true;
      cantrips += atLevel(cp as number[], cls.level);
    }
    if (typeof c.preparedSpells === 'string') {
      hasPrepared = true;
      prepared += evalPreparedFormula(c.preparedSpells, cls.level, abilityMod, profBonus);
    }
    const skp = (c.spellsKnownProgression ?? c.spellsKnownProgressionFixed) as unknown;
    if (Array.isArray(skp)) {
      hasKnown = true;
      known += atLevel(skp as number[], cls.level);
    }
  }

  return {
    cantrips: hasCantrips ? cantrips : null,
    prepared: hasPrepared ? prepared : null,
    known: hasKnown ? known : null
  };
}
