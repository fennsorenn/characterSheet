import type { Catalog, NamedEntry } from '../data/catalog.js';
import type { Character, CatalogRef } from './schema.js';
import { totalLevel } from './schema.js';
import type { GrantedSpell } from './grantedSpells.js';

/**
 * "Choose a spell" features. Some additionalSpells entries don't grant a fixed
 * spell but a choice ("choose": "level=1|class=Sorcerer"). We surface each such
 * choice as a slot the player fills via a picker; the picked spell then flows
 * into the spell list as granted by that feature.
 */

export interface ChoiceFilter {
  levels: number[];
  classes: string[];
  schools: string[];
  ritual: boolean;
}

export interface ChoiceSlot {
  /** Stable key: `${featureName}|${featureSource}|${index}`. */
  key: string;
  featureName: string;
  filter: ChoiceFilter;
  label: string;
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

export function parseChoiceFilter(spec: string): ChoiceFilter {
  const f: ChoiceFilter = { levels: [], classes: [], schools: [], ritual: false };
  for (const part of spec.split('|')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    const vals = part
      .slice(eq + 1)
      .split(';')
      .map((v) => v.trim())
      .filter(Boolean);
    if (key === 'level') f.levels = vals.map(Number).filter((n) => !Number.isNaN(n));
    else if (key === 'class') f.classes = vals.map(titleCase);
    else if (key === 'school') f.schools = vals.map((v) => v.toUpperCase());
    else if (key.startsWith('components')) f.ritual = vals.includes('ritual');
  }
  return f;
}

const SCHOOL_NAMES: Record<string, string> = {
  A: 'abjuration',
  C: 'conjuration',
  D: 'divination',
  E: 'enchantment',
  V: 'evocation',
  I: 'illusion',
  N: 'necromancy',
  T: 'transmutation'
};

export function choiceLabel(f: ChoiceFilter): string {
  const lvl = f.levels.length
    ? f.levels.every((l) => l === 0)
      ? 'cantrip'
      : `level ${f.levels.join('/')}`
    : 'spell';
  const bits: string[] = [];
  if (f.classes.length) bits.push(f.classes.join('/'));
  if (f.schools.length) bits.push(f.schools.map((s) => SCHOOL_NAMES[s] ?? s).join('/'));
  if (f.ritual) bits.push('ritual');
  return `Choose a ${lvl}${bits.length ? ` (${bits.join(', ')})` : ''} spell`;
}

const isRitual = (s: NamedEntry) => !!(s.meta as { ritual?: boolean } | undefined)?.ritual;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Spell-choice slots from a feature's additionalSpells, level-gated. */
export function additionalSpellChoices(additionalSpells: unknown, charLevel: number): ChoiceFilter[] {
  const out: ChoiceFilter[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node && typeof node === 'object') {
      const o = node as Record<string, unknown>;
      if (typeof o.choose === 'string') {
        out.push(parseChoiceFilter(o.choose));
        return;
      }
      if (Array.isArray(o.choose)) return; // ability-score choice, not a spell
      for (const k of Object.keys(o).sort()) {
        if (/^\d+$/.test(k) && Number(k) > charLevel) continue;
        walk(o[k]);
      }
    }
  };
  for (const block of arr(additionalSpells)) {
    if (!block || typeof block !== 'object') continue;
    const b = block as Record<string, unknown>;
    for (const bucket of ['known', 'prepared', 'will', 'innate']) walk(b[bucket]);
  }
  return out;
}

/** Does a catalog spell satisfy a choice filter? Uses the class index (_classes). */
export function spellMatchesChoice(spell: NamedEntry, f: ChoiceFilter): boolean {
  if (f.levels.length && !f.levels.includes((spell.level as number) ?? -1)) return false;
  if (f.classes.length) {
    const cls = (spell._classes as string[]) ?? [];
    if (!f.classes.some((c) => cls.includes(c))) return false;
  }
  if (f.schools.length && !f.schools.includes(String(spell.school).toUpperCase())) return false;
  if (f.ritual && !isRitual(spell)) return false;
  return true;
}

const lc = (s: string) => s.toLowerCase();
const findRef = (list: NamedEntry[], ref: CatalogRef) =>
  list.find((e) => lc(e.name) === lc(ref.name) && lc(String(e.source)) === lc(ref.source));

/** All spell-choice slots for a character, across feats/race/background/subclass. */
export function featureSpellChoices(character: Character, catalog: Catalog): ChoiceSlot[] {
  const slots: ChoiceSlot[] = [];
  const charLevel = totalLevel(character);

  const add = (obj: NamedEntry | undefined, level: number) => {
    if (!obj?.additionalSpells) return;
    additionalSpellChoices(obj.additionalSpells, level).forEach((filter, index) => {
      slots.push({
        key: `${obj.name}|${obj.source}|${index}`,
        featureName: obj.name,
        filter,
        label: choiceLabel(filter)
      });
    });
  };

  add(character.race && findRef(catalog.entries.race, character.race), charLevel);
  add(character.background && findRef(catalog.entries.background, character.background), charLevel);
  for (const featRef of character.feats) add(findRef(catalog.entries.feat, featRef), charLevel);
  for (const cls of character.classes) {
    if (!cls.subclass) continue;
    const sc = catalog.classData.subclass.find(
      (s) =>
        lc(String(s.className)) === lc(cls.name) &&
        (lc(String(s.shortName)) === lc(cls.subclass!) || lc(s.name) === lc(cls.subclass!))
    );
    add(sc, cls.level);
  }
  return slots;
}

/** Picked spells (from spellChoices) as granted spells, by their feature. */
export function choiceGrantedSpells(character: Character): GrantedSpell[] {
  const out: GrantedSpell[] = [];
  for (const [key, ref] of Object.entries(character.spellChoices ?? {})) {
    if (!ref) continue;
    const featureName = key.split('|')[0];
    out.push({ name: ref.name, source: ref.source, grantedBy: featureName });
  }
  return out;
}
