import { ABILITIES, ABILITY_NAMES, SKILLS, type Ability } from './abilities.js';
import type { Character, CharacterModifier } from './schema.js';
import { allFeatRefs, CUSTOM_SOURCE } from './schema.js';
import type { Catalog, NamedEntry } from '../data/catalog.js';

/**
 * Generic feature-grant pool.
 *
 * Rather than hardcoding "this feature grants +1 Con" / "that one grants poison
 * resistance" per stat, we walk the *structured* grant fields the 5etools data
 * already carries on races, backgrounds, and feats — `ability`,
 * `skillProficiencies`, `savingThrowProficiencies`, `resist`, `immune`,
 * `languageProficiencies`, `senses`, `speed`, … — and gather them into one pool,
 * each entry annotated with its source feature. Numeric grants flow into the
 * calc graph as modifiers; set grants (proficiencies, resistances, languages,
 * …) are joined into named sets the UI reads. `choose` blocks become pending
 * picks the player fills, stored back on the character.
 */

/** Set-valued grant categories (members are joined, not summed). */
export type SetCategory =
  | 'skillProf'
  | 'saveProf'
  | 'toolProf'
  | 'weaponProf'
  | 'armorProf'
  | 'expertise'
  | 'resist'
  | 'immune'
  | 'conditionImmune'
  | 'language';

/** A numeric grant on a calc node (ability scores; also senses/speeds for display). */
export interface NumericGrant {
  target: string;
  source: string;
  value: number;
  /** How multiple grants on the same target combine. */
  combine: 'sum' | 'max';
}

/** One membership in a set-valued stat, annotated with its source. */
export interface SetGrant {
  category: SetCategory;
  member: string;
  source: string;
}

/** A `choose`/`any` block awaiting the player's pick(s). */
export interface GrantChoice {
  /** Stable storage key. */
  key: string;
  source: string;
  /** 'ability' picks raise ability scores; the rest add set members. */
  category: SetCategory | 'ability';
  /** Explicit options; empty when picking from an open universe. */
  from: string[];
  /** Universe to pick from when `from` is empty (skills, abilities, damage…). */
  universe?: Universe;
  count: number;
  /** Bonus per pick, for ability choices. */
  amount: number;
  /**
   * Per-pick amounts for an uneven spread — 2024 backgrounds give "+2 and +1",
   * not "+1 twice". Slot j is worth `weights[j]`; `amount` covers the even case.
   */
  weights?: number[];
  label: string;
  /**
   * Mutually exclusive spreads: a 2024 background offers *either* +2/+1 to two
   * abilities *or* +1 to each of three, and exactly one of them applies. The
   * pool carries only the active one; `groupOptions` names the rest so the
   * picker can offer the switch, and the pick is stored under `group`.
   */
  group?: string;
  groupOptions?: string[];
  groupIndex?: number;
}

export type Universe = 'skill' | 'ability' | 'damage' | 'language' | 'tool' | 'weapon' | 'armor' | 'open';

export interface GrantPool {
  numeric: NumericGrant[];
  sets: SetGrant[];
  choices: GrantChoice[];
}

export const GRANT_PREFIX = 'grant:';
/** Storage key for the i-th choose block of `field` on `source`. */
export function grantKey(source: string, field: string, index: number | string): string {
  return `${GRANT_PREFIX}${source}|${field}|${index}`;
}

/** Which alternative is in force, defaulting to the first and never off the end. */
function clampIndex(stored: string | undefined, length: number): number {
  const n = Number(stored);
  return Number.isInteger(n) && n >= 0 && n < length ? n : 0;
}

export const DAMAGE_TYPES = [
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning',
  'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'
];

/** Map each set field name in the data to a category + the universe to pick from. */
const SET_FIELDS: Record<string, { category: SetCategory; universe: Universe }> = {
  skillProficiencies: { category: 'skillProf', universe: 'skill' },
  savingThrowProficiencies: { category: 'saveProf', universe: 'ability' },
  toolProficiencies: { category: 'toolProf', universe: 'tool' },
  weaponProficiencies: { category: 'weaponProf', universe: 'weapon' },
  armorProficiencies: { category: 'armorProf', universe: 'armor' },
  expertise: { category: 'expertise', universe: 'skill' },
  resist: { category: 'resist', universe: 'damage' },
  immune: { category: 'immune', universe: 'damage' },
  conditionImmune: { category: 'conditionImmune', universe: 'open' },
  languageProficiencies: { category: 'language', universe: 'language' }
};

const isAbility = (s: unknown): s is Ability => (ABILITIES as readonly string[]).includes(s as string);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const lc = (s: string) => s.toLowerCase();
const findRef = (list: NamedEntry[], ref: { name: string; source: string }) =>
  list.find((e) => lc(e.name) === lc(ref.name) && lc(String(e.source)) === lc(ref.source));

export function universeMembers(u: Universe): string[] {
  if (u === 'skill') return [...SKILLS];
  if (u === 'ability') return [...ABILITIES];
  if (u === 'damage') return [...DAMAGE_TYPES];
  return [];
}

export function memberLabel(category: SetCategory | 'ability', member: string): string {
  if (category === 'ability' || category === 'saveProf') return isAbility(member) ? ABILITY_NAMES[member] : member;
  // Strip 5etools `name|source` reference tags (e.g. "battleaxe|phb").
  return member.split('|')[0].replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Parse a `choose`/`any` token into a GrantChoice, or undefined if neither. */
function parseChoose(
  value: unknown,
  key: string,
  opts: { source: string; field: string; index: number; category: SetCategory | 'ability'; universe: Universe; amount: number }
): GrantChoice | undefined {
  // `{ choose: { weighted: { from, weights } } }` — an uneven spread, one
  // ability per weight. Read as an even choice it becomes "+1 to any two",
  // which is both the wrong sizes and the wrong abilities.
  if (key === 'choose' && value && typeof value === 'object' && 'weighted' in value) {
    const w = (value as { weighted?: { from?: unknown; weights?: unknown } }).weighted ?? {};
    const from = arr(w.from).map(String);
    const weights = arr(w.weights).filter((n): n is number => typeof n === 'number');
    if (!weights.length) return undefined;
    return {
      key: grantKey(opts.source, opts.field, opts.index),
      source: opts.source,
      category: opts.category,
      from,
      universe: from.length ? undefined : opts.universe,
      count: weights.length,
      amount: weights[0],
      weights,
      label: describeWeighted(weights, from, opts.category)
    };
  }
  // `{ choose: { from, count?, amount? } }`
  if (key === 'choose' && value && typeof value === 'object') {
    const c = value as { from?: unknown; count?: unknown; amount?: unknown };
    const from = (Array.isArray(c.from) ? c.from : []).map(String);
    const count = typeof c.count === 'number' ? c.count : 1;
    const amount = typeof c.amount === 'number' ? c.amount : opts.amount;
    return {
      key: grantKey(opts.source, opts.field, opts.index),
      source: opts.source,
      category: opts.category,
      from,
      universe: from.length ? undefined : opts.universe,
      count,
      amount,
      label: describeChoice(opts.category, from, count, amount, opts.universe)
    };
  }
  // `{ any: N }` or `{ anySkill: N }` — N from an open universe.
  if (/^any/i.test(key) && typeof value === 'number') {
    const universe = anyUniverse(key, opts.universe);
    return {
      key: grantKey(opts.source, opts.field, opts.index),
      source: opts.source,
      category: opts.category,
      from: [],
      universe,
      count: value,
      amount: opts.amount,
      label: describeChoice(opts.category, [], value, opts.amount, universe)
    };
  }
  return undefined;
}

/** "+2/+1 to Con, Wis or Cha" — the spread first, since that is what is chosen. */
export function describeWeighted(
  weights: number[],
  from: string[],
  category: SetCategory | 'ability' = 'ability'
): string {
  const spread = weights.map((w) => `+${w}`).join('/');
  const pool = from.map((m) => memberLabel(category, m).slice(0, 3)).join(', ');
  return pool ? `${spread} among ${pool}` : spread;
}

function anyUniverse(key: string, fallback: Universe): Universe {
  const k = key.toLowerCase();
  if (k.includes('skill')) return 'skill';
  if (k.includes('tool')) return 'tool';
  if (k.includes('language')) return 'language';
  if (k.includes('weapon')) return 'weapon';
  if (k.includes('armor')) return 'armor';
  return fallback;
}

function describeChoice(category: SetCategory | 'ability', from: string[], count: number, amount: number, universe: Universe): string {
  const opts = (from.length ? from : universeMembers(universe)).map((m) => memberLabel(category, m).slice(0, category === 'ability' || category === 'saveProf' ? 3 : 99));
  const pool = opts.length && opts.length <= 6 ? opts.join('/') : universeNoun(universe, count);
  if (category === 'ability') return `+${amount} to ${count > 1 ? `${count} of ` : ''}${pool}`;
  return `Choose ${count > 1 ? `${count} ` : ''}${pool}`;
}

function universeNoun(u: Universe, count: number): string {
  const n: Record<Universe, string> = {
    skill: 'skill', ability: 'ability', damage: 'damage type', language: 'language',
    tool: 'tool', weapon: 'weapon', armor: 'armor', open: 'option'
  };
  return count > 1 ? `${n[u]}s` : `a ${n[u]}`;
}

/** Class `startingProficiencies` subfields use different names than the top-level ones. */
const CLASS_SUBFIELDS: Record<string, { category: SetCategory; universe: Universe }> = {
  armor: { category: 'armorProf', universe: 'armor' },
  weapons: { category: 'weaponProf', universe: 'weapon' },
  skills: { category: 'skillProf', universe: 'skill' },
  tools: { category: 'toolProf', universe: 'tool' },
  languages: { category: 'language', universe: 'language' }
};

/** Parse a set-field's entries (strings, `{x:true}`, `choose`, `any`) into the pool. */
function parseSetEntries(
  rows: unknown[],
  opts: { category: SetCategory; universe: Universe; field: string; source: string },
  character: Character,
  pool: GrantPool
): void {
  rows.forEach((row, i) => {
    if (typeof row === 'string') {
      pool.sets.push({ category: opts.category, member: row, source: opts.source });
      return;
    }
    if (!row || typeof row !== 'object') return;
    for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
      const choice = parseChoose(v, k, { ...opts, index: i, amount: 1 });
      if (choice) {
        pool.choices.push(choice);
        for (const m of character.grantChoices[choice.key] ?? []) pool.sets.push({ category: opts.category, member: m, source: opts.source });
      } else if (v === true) {
        pool.sets.push({ category: opts.category, member: k, source: opts.source });
      }
    }
  });
}

/**
 * Walk a class's proficiencies. The first ("starting") class grants full
 * `startingProficiencies` plus its saving throws; additional classes grant only
 * the reduced `multiclassing.proficienciesGained` subset and no saves (5e
 * multiclassing rules).
 */
function gatherClass(entry: NamedEntry, character: Character, pool: GrantPool, isFirst: boolean): void {
  const source = entry.name;
  let profs: unknown;
  if (isFirst) {
    // Saving-throw proficiencies come only from the starting class.
    for (const a of arr(entry.proficiency)) if (typeof a === 'string') pool.sets.push({ category: 'saveProf', member: a, source });
    profs = entry.startingProficiencies;
  } else {
    profs = (entry.multiclassing as { proficienciesGained?: unknown } | undefined)?.proficienciesGained;
  }
  if (profs && typeof profs === 'object') {
    const prefix = isFirst ? 'sp' : 'mc';
    for (const [field, { category, universe }] of Object.entries(CLASS_SUBFIELDS)) {
      parseSetEntries(arr((profs as Record<string, unknown>)[field]), { category, universe, field: `${prefix}.${field}`, source }, character, pool);
    }
  }
}

/** Walk one feature source's grant fields into the pool. */
function gatherFrom(entry: NamedEntry, character: Character, pool: GrantPool): void {
  const source = entry.name;

  // Ability scores: `ability: [{con:1}]` (fixed) or `[{choose:{from,amount,count}}]`.
  // More than one `ability` block means alternatives, not a sum: a 2024
  // background offers +2/+1 *or* +1/+1/+1, and one of them applies. Applying
  // both would hand out five points and prompt for picks twice.
  const blocks = arr(entry.ability).filter(
    (blk) => blk && typeof blk === 'object' && !(blk as { hidden?: boolean }).hidden
  ) as Record<string, unknown>[];
  const parsed = blocks.map((o, i) =>
    'choose' in o
      ? parseChoose(o.choose, 'choose', {
          source, field: 'ability', index: i, category: 'ability', universe: 'ability', amount: 1
        })
      : undefined
  );
  const alternatives = blocks.length > 1 && parsed.every(Boolean);
  const group = alternatives ? grantKey(source, 'ability', 'alt') : undefined;
  const active = alternatives ? clampIndex(character.featureOptions[group!], blocks.length) : 0;

  blocks.forEach((o, i) => {
    if (alternatives && i !== active) return;
    const choice = parsed[i];
    if (choice) {
      pool.choices.push(
        group
          ? {
              ...choice,
              group,
              groupIndex: i,
              // Just the spread in the switcher — the pool it comes from is the
              // same for every alternative and is already in the full label.
              groupOptions: parsed.map((p, n) =>
                p?.weights ? p.weights.map((w) => `+${w}`).join('/') : (p?.label ?? `Option ${n + 1}`)
              )
            }
          : choice
      );
      const picks = character.abilityChoices[choice.key] ?? {};
      for (const a of ABILITIES) {
        const v = picks[a];
        if (typeof v === 'number' && v) pool.numeric.push({ target: `ability.${a}.score`, source, value: v, combine: 'sum' });
      }
      return;
    }
    for (const a of ABILITIES) {
      const v = o[a];
      if (typeof v === 'number' && v) pool.numeric.push({ target: `ability.${a}.score`, source, value: v, combine: 'sum' });
    }
  });

  // Set-valued fields (proficiencies, resistances, languages, …).
  for (const [field, { category, universe }] of Object.entries(SET_FIELDS)) {
    parseSetEntries(arr(entry[field]), { category, universe, field, source }, character, pool);
  }

  // Senses (max per type) — array form `senses: [{darkvision:60}]` and the
  // top-level numeric form races use (`darkvision: 60`).
  for (const field of ['senses', 'bonusSenses']) {
    arr(entry[field]).forEach((row) => {
      if (row && typeof row === 'object') {
        for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
          if (typeof v === 'number') pool.numeric.push({ target: `sense.${k}`, source, value: v, combine: 'max' });
        }
      }
    });
  }
  for (const s of ['darkvision', 'blindsight', 'truesight', 'tremorsense']) {
    if (typeof entry[s] === 'number') pool.numeric.push({ target: `sense.${s}`, source, value: entry[s] as number, combine: 'max' });
  }

  // Speed (max per type) — `speed: {walk:25, fly:50}` or a bare number (walk).
  if (typeof entry.speed === 'number') {
    pool.numeric.push({ target: 'speed.walk', source, value: entry.speed, combine: 'max' });
  } else if (entry.speed && typeof entry.speed === 'object') {
    for (const [k, v] of Object.entries(entry.speed as Record<string, unknown>)) {
      if (typeof v === 'number') pool.numeric.push({ target: `speed.${k}`, source, value: v, combine: 'max' });
    }
  }
}

/** Gather the full grant pool from a character's race, background, and feats. */
export function gatherGrants(character: Character, catalog: Catalog): GrantPool {
  const pool: GrantPool = { numeric: [], sets: [], choices: [] };
  const sources: (NamedEntry | undefined)[] = [
    character.race && findRef(catalog.entries.race, character.race),
    character.background && findRef(catalog.entries.background, character.background),
    ...allFeatRefs(character).map((ref) => findRef(catalog.entries.feat, ref))
  ];
  for (const entry of sources) if (entry) gatherFrom(entry, character, pool);
  // Class proficiencies: full from the first class, the multiclass subset from the rest.
  character.classes.forEach((cls, i) => {
    const entry = findRef(catalog.entries.class, cls);
    if (entry) gatherClass(entry, character, pool, i === 0);
  });
  gatherCustom(character, pool);
  return pool;
}

/**
 * The player's own movement, senses and proficiencies, merged into the same
 * pool as everything a race or feat grants.
 *
 * Doing it here rather than in each block means a hand-added weapon proficiency
 * reaches the attack rows, a hand-added skill proficiency reaches the graph, and
 * a hand-added swim speed reaches the traits row — none of which know it was
 * typed rather than granted.
 */
export function gatherCustom(character: Character, pool: GrantPool): void {
  for (const g of character.customGrants ?? []) {
    if (g.kind === 'set') {
      if (!g.member.trim()) continue;
      pool.sets.push({ category: g.category as SetCategory, member: g.member.trim(), source: CUSTOM_SOURCE });
    } else if (Number.isFinite(g.feet)) {
      const prefix = g.kind === 'speed' ? 'speed' : 'sense';
      pool.numeric.push({
        target: `${prefix}.${g.name.trim().toLowerCase()}`,
        source: CUSTOM_SOURCE,
        value: g.feet,
        combine: 'max'
      });
    }
  }
}

/** Numeric grants as graph modifiers (sum-combined targets; max ones are skipped by the graph). */
export function grantNumericModifiers(pool: GrantPool): CharacterModifier[] {
  return pool.numeric
    .filter((g) => g.combine === 'sum')
    .map((g) => ({ target: g.target, source: g.source, value: g.value }));
}

/** Highest value per `max`-combined numeric target (senses, speeds), with sources. */
export function maxNumeric(pool: GrantPool, prefix: string): { name: string; value: number; sources: string[] }[] {
  const best = new Map<string, { value: number; sources: Set<string> }>();
  for (const g of pool.numeric) {
    if (g.combine !== 'max' || !g.target.startsWith(prefix)) continue;
    const name = g.target.slice(prefix.length);
    const cur = best.get(name);
    if (!cur || g.value > cur.value) best.set(name, { value: g.value, sources: new Set([g.source]) });
    else if (g.value === cur.value) cur.sources.add(g.source);
  }
  return [...best.entries()].map(([name, b]) => ({ name, value: b.value, sources: [...b.sources] }));
}

/** Distinct members of a set category, each with the sources that grant it. */
export function setMembers(pool: GrantPool, category: SetCategory): { member: string; sources: string[] }[] {
  const by = new Map<string, Set<string>>();
  for (const g of pool.sets) {
    if (g.category !== category) continue;
    const k = g.member.toLowerCase();
    (by.get(k) ?? by.set(k, new Set()).get(k)!).add(g.source);
  }
  // Preserve first-seen display casing.
  const display = new Map<string, string>();
  for (const g of pool.sets) if (g.category === category && !display.has(g.member.toLowerCase())) display.set(g.member.toLowerCase(), g.member);
  return [...by.entries()].map(([k, sources]) => ({ member: display.get(k) ?? k, sources: [...sources] }));
}
