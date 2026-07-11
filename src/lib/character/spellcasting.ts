import type { Catalog } from '../data/catalog.js';
import type { Character } from './schema.js';
import { ABILITIES, type Ability } from './abilities.js';

/**
 * Spellcasting capacity per class, for the spell-counter denominators.
 *
 * Each caster class is classified from its data:
 *   - prepared casters (Cleric, Druid, Paladin, Artificer, Wizard) have a
 *     `preparedSpells` formula → their limit is on *prepared* leveled spells;
 *   - "known" casters (Bard, Sorcerer, Ranger, Warlock) have a cumulative
 *     `spellsKnownProgression` → their limit is on *known* leveled spells.
 * Cantrips come from `cantripProgression`.
 *
 * For multiclass characters each leveled spell / cantrip is assigned to exactly
 * one class for counting (you can't prepare a Cleric spell in a Wizard slot):
 * greedily, most-constrained spells first (fewest fitting classes), each placed
 * in the fitting class with the most remaining room. Unprepared spells that a
 * prepared caster simply *knows* (it knows its whole list) don't consume a slot.
 *
 * The Wizard additionally tracks a *spellbook* size (sum of the per-level
 * `spellsKnownProgressionFixed` deltas). Every leveled spell that fits the
 * wizard counts toward its book regardless of prepared status. This is purely
 * informational: wizards copy extra spells into their book, so exceeding the
 * book size is normal and is never flagged as over-limit.
 */

export type CasterKind = 'prepared' | 'known';

export interface CasterClass {
  name: string;
  source: string;
  level: number;
  ability: Ability;
  kind: CasterKind;
  /** Cantrips known, or null if the class grants none. */
  cantrips: number | null;
  /** Leveled-spell limit: prepared limit (prepared) or spells-known (known). */
  spells: number | null;
  /**
   * Spellbook size — the number of leveled spells the class can have recorded
   * (Wizard only; sum of `spellsKnownProgressionFixed` up to the class level).
   * Informational: wizards copy extra spells in, so this is expected to be
   * exceeded and is never flagged as over-limit. Null for non-spellbook classes.
   */
  book: number | null;
}

/** Per-class spell counts vs limits, after assignment. */
export interface ClassSpellCount {
  name: string;
  kind: CasterKind;
  cantripsUsed: number;
  cantripLimit: number | null;
  spellsUsed: number;
  spellLimit: number | null;
  /** Leveled spells assigned to this class regardless of status (spellbook). */
  bookUsed: number;
  /** Spellbook size; informational (may be exceeded), null if not applicable. */
  bookLimit: number | null;
}

const lc = (s: string) => s.toLowerCase();
const isAbility = (s: string): s is Ability => (ABILITIES as readonly string[]).includes(s);
const findClass = (catalog: Catalog, ref: { name: string; source: string }) =>
  catalog.entries.class.find((c) => lc(c.name) === lc(ref.name) && lc(String(c.source)) === lc(ref.source));
const atLevel = (prog: number[], level: number) => prog[Math.min(Math.max(level, 1), prog.length) - 1] ?? 0;

/** Resolve one token (`<$level$>`, `<$wis_mod$>`, a number, …) to a value. */
function tokenValue(t: string, classLevel: number, abilityMod: (a: Ability) => number, profBonus: number): number {
  const tok = t.match(/^<\$(.+)\$>$/)?.[1];
  if (!tok) return Number(t) || 0;
  if (tok === 'level') return classLevel;
  if (tok === 'level_half' || tok === 'level_half_rounded_down') return Math.floor(classLevel / 2);
  if (tok === 'level_half_rounded_up') return Math.ceil(classLevel / 2);
  if (tok === 'prof_bonus') return profBonus;
  const abil = tok.match(/^([a-z]{3})_mod$/)?.[1];
  return abil && isAbility(abil) ? abilityMod(abil) : 0;
}

/**
 * Evaluate a 5etools `preparedSpells` formula. Official forms are sums of terms,
 * where a term may be a token, a number, or `token / number` (e.g. half-casters'
 * "<$level$> / 2 + <$cha_mod$>"). Division rounds down; result is at least 1.
 */
export function evalPreparedFormula(
  formula: string,
  classLevel: number,
  abilityMod: (a: Ability) => number,
  profBonus: number
): number {
  let total = 0;
  for (const term of formula.split('+')) {
    const t = term.trim();
    if (t.includes('/')) {
      const [l, r] = t.split('/').map((s) => s.trim());
      total += Math.floor(tokenValue(l, classLevel, abilityMod, profBonus) / (tokenValue(r, classLevel, abilityMod, profBonus) || 1));
    } else {
      total += tokenValue(t, classLevel, abilityMod, profBonus);
    }
  }
  return Math.max(1, total);
}

/** The character's caster classes with their per-class limits. */
export function casterClasses(
  character: Character,
  catalog: Catalog,
  abilityMod: (a: Ability) => number,
  profBonus: number
): CasterClass[] {
  const out: CasterClass[] = [];
  for (const cls of character.classes) {
    const c = findClass(catalog, cls);
    if (!c || !c.spellcastingAbility) continue;
    const ability = String(c.spellcastingAbility);
    const cp = c.cantripProgression;
    const cantrips = Array.isArray(cp) ? atLevel(cp as number[], cls.level) : null;

    // Spellbook size: `spellsKnownProgressionFixed` is a per-level DELTA array,
    // so the total recorded spells = sum of the first `level` entries.
    const skf = c.spellsKnownProgressionFixed;
    const book = Array.isArray(skf)
      ? (skf as number[]).slice(0, Math.max(0, cls.level)).reduce((a, b) => a + b, 0)
      : null;

    let kind: CasterKind;
    let spells: number | null;
    if (typeof c.preparedSpells === 'string') {
      // 2014: a formula string, e.g. "<$level$> + <$wis_mod$>".
      kind = 'prepared';
      spells = evalPreparedFormula(c.preparedSpells, cls.level, abilityMod, profBonus);
    } else if (Array.isArray(c.preparedSpellsProgression)) {
      // 2024: a fixed per-level prepared-count array (no ability-mod formula).
      kind = 'prepared';
      spells = atLevel(c.preparedSpellsProgression as number[], cls.level);
    } else if (Array.isArray(c.spellsKnownProgression)) {
      kind = 'known';
      spells = atLevel(c.spellsKnownProgression as number[], cls.level);
    } else {
      kind = 'prepared';
      spells = null;
    }
    out.push({
      name: c.name,
      source: String(c.source),
      level: cls.level,
      ability: isAbility(ability) ? ability : 'int',
      kind,
      cantrips,
      spells,
      book
    });
  }
  return out;
}

interface SpellRef {
  level: number;
  classes: string[];
  prepared: boolean;
}

/** Greedily assign each spell to one class and tally per-class usage vs limits. */
export function assignSpellCounts(casters: CasterClass[], spells: SpellRef[]): ClassSpellCount[] {
  const cantripUsed = new Map<string, number>(casters.map((c) => [c.name, 0]));
  const spellUsed = new Map<string, number>(casters.map((c) => [c.name, 0]));
  // Spellbook tally: leveled spells assigned to a book class regardless of
  // prepared status. A leveled spell counts toward a book class whenever it can
  // only be cast/recorded by book classes (e.g. a Wizard-only spell), even if it
  // doesn't consume a prepared slot.
  const bookUsed = new Map<string, number>(casters.map((c) => [c.name, 0]));

  const fits = (s: SpellRef, name: string) =>
    s.classes.length === 0 || s.classes.some((cn) => lc(cn) === lc(name));
  // Pick the fitting candidate with the most remaining room in `used` vs limit.
  const mostRoom = (cands: CasterClass[], used: Map<string, number>, limitOf: (c: CasterClass) => number | null) =>
    cands.reduce((best, c) => {
      const room = (limitOf(c) ?? Infinity) - (used.get(c.name) ?? 0);
      const bestRoom = best ? (limitOf(best) ?? Infinity) - (used.get(best.name) ?? 0) : -Infinity;
      return room > bestRoom ? c : best;
    }, undefined as CasterClass | undefined);

  // Most-constrained first: fewest fitting classes.
  const byConstraint = (a: SpellRef, b: SpellRef) =>
    casters.filter((c) => fits(a, c.name)).length - casters.filter((c) => fits(b, c.name)).length;

  // Cantrips: every caster that grants cantrips can hold them.
  for (const s of spells.filter((s) => s.level === 0).sort(byConstraint)) {
    const cands = casters.filter((c) => c.cantrips != null && fits(s, c.name));
    const pick = mostRoom(cands, cantripUsed, (c) => c.cantrips);
    if (pick) cantripUsed.set(pick.name, (cantripUsed.get(pick.name) ?? 0) + 1);
  }

  // Leveled spells: prepared spells must occupy a slot; an unprepared spell a
  // prepared caster merely knows (it knows its whole list) is free, so it only
  // consumes a slot when it fits only "known" casters.
  for (const s of spells.filter((s) => s.level > 0).sort(byConstraint)) {
    const fitting = casters.filter((c) => fits(s, c.name));
    const prepared = fitting.filter((c) => c.kind === 'prepared');
    const known = fitting.filter((c) => c.kind === 'known');
    let pool: CasterClass[];
    if (s.prepared) pool = prepared.length ? prepared : known;
    else pool = prepared.length ? [] : known; // known by a prepared caster → free
    const pick = mostRoom(pool, spellUsed, (c) => c.spells);
    if (pick) spellUsed.set(pick.name, (spellUsed.get(pick.name) ?? 0) + 1);

    // Spellbook: any leveled spell that fits a book class is recorded in it,
    // regardless of prepared status. Prefer the book class the prepared slot
    // went to (when any), else the fitting book class with the most room.
    const bookCands = fitting.filter((c) => c.book != null);
    if (bookCands.length) {
      const bookPick =
        pick && pick.book != null ? pick : mostRoom(bookCands, bookUsed, (c) => c.book);
      if (bookPick) bookUsed.set(bookPick.name, (bookUsed.get(bookPick.name) ?? 0) + 1);
    }
  }

  return casters.map((c) => ({
    name: c.name,
    kind: c.kind,
    cantripsUsed: cantripUsed.get(c.name) ?? 0,
    cantripLimit: c.cantrips,
    spellsUsed: spellUsed.get(c.name) ?? 0,
    spellLimit: c.spells,
    bookUsed: bookUsed.get(c.name) ?? 0,
    bookLimit: c.book
  }));
}
