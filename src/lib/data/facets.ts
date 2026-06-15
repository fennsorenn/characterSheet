import type { Category, NamedEntry } from './catalog.js';

/**
 * Faceted filtering for the detailed import browser. A facet exposes the values
 * an entry has for some dimension (level, school, rarity, type…); selecting
 * values filters entries (OR within a facet, AND across facets), and option
 * lists are computed with counts that respect the other active filters — the
 * usual faceted-search behaviour.
 */
export interface Facet {
  key: string;
  label: string;
  /** Facet values an entry has (for both option lists and matching). */
  values: (entry: NamedEntry) => string[];
  /** Display label for a value. */
  optionLabel?: (value: string) => string;
  /** Fixed option order (otherwise by count, then label). */
  order?: string[];
}

export type Selection = Record<string, Set<string>>;
export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

const normalize = (s: string) => s.toLowerCase();
const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const bare = (code: unknown) => (typeof code === 'string' ? code.split('|')[0] : '');

/** Does an entry pass the name query and all facet selections (optionally skipping one)? */
export function entryMatches(
  entry: NamedEntry,
  name: string,
  facets: Facet[],
  selection: Selection,
  exclude?: string
): boolean {
  if (name && !normalize(entry.name).includes(normalize(name))) return false;
  for (const facet of facets) {
    if (facet.key === exclude) continue;
    const selected = selection[facet.key];
    if (!selected || selected.size === 0) continue;
    if (!facet.values(entry).some((v) => selected.has(v))) return false;
  }
  return true;
}

export function filterEntries(
  entries: NamedEntry[],
  name: string,
  facets: Facet[],
  selection: Selection
): NamedEntry[] {
  return entries.filter((e) => entryMatches(e, name, facets, selection));
}

/** Compute the option list + counts for each facet, cross-filtered by the others. */
export function facetOptions(
  entries: NamedEntry[],
  name: string,
  facets: Facet[],
  selection: Selection
): Record<string, FacetOption[]> {
  const out: Record<string, FacetOption[]> = {};
  for (const facet of facets) {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      if (!entryMatches(entry, name, facets, selection, facet.key)) continue;
      for (const v of facet.values(entry)) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    let opts = [...counts.entries()].map(([value, count]) => ({
      value,
      label: facet.optionLabel ? facet.optionLabel(value) : value,
      count
    }));
    if (facet.order) {
      const rank = (v: string) => {
        const i = facet.order!.indexOf(v);
        return i === -1 ? 999 : i;
      };
      opts.sort((a, b) => rank(a.value) - rank(b.value) || a.label.localeCompare(b.label));
    } else {
      opts.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    }
    out[facet.key] = opts;
  }
  return out;
}

// --- Facet definitions per category ---

const SCHOOL_NAMES: Record<string, string> = {
  A: 'Abjuration',
  C: 'Conjuration',
  D: 'Divination',
  E: 'Enchantment',
  V: 'Evocation',
  I: 'Illusion',
  N: 'Necromancy',
  T: 'Transmutation'
};
const LEVELS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
};

function hasConcentration(e: NamedEntry): boolean {
  return arr(e.duration).some(
    (d) => typeof d === 'object' && d !== null && (d as { concentration?: boolean }).concentration
  );
}

const SPELL_FACETS: Facet[] = [
  {
    key: 'level',
    label: 'Level',
    order: LEVELS,
    values: (e) => [String(e.level ?? 0)],
    optionLabel: (v) => (v === '0' ? 'Cantrip' : ordinal(+v))
  },
  {
    key: 'school',
    label: 'School',
    order: Object.values(SCHOOL_NAMES),
    values: (e) =>
      typeof e.school === 'string' ? [SCHOOL_NAMES[e.school.toUpperCase()] ?? 'Other'] : []
  },
  { key: 'damage', label: 'Damage type', values: (e) => arr(e.damageInflict).map(cap) },
  {
    key: 'resolution',
    label: 'Resolution',
    values: (e) => {
      const o: string[] = [];
      if (arr(e.savingThrow).length) o.push('Saving throw');
      if (arr(e.spellAttack).length) o.push('Spell attack');
      return o;
    }
  },
  {
    key: 'props',
    label: 'Properties',
    values: (e) => {
      const o: string[] = [];
      const misc = arr(e.miscTags);
      if (hasConcentration(e)) o.push('Concentration');
      if ((e.meta as { ritual?: boolean } | undefined)?.ritual) o.push('Ritual');
      if (misc.includes('HL') || misc.includes('THP')) o.push('Healing');
      if (misc.includes('SMN')) o.push('Summon');
      return o;
    }
  },
  {
    key: 'components',
    label: 'Components',
    order: ['V', 'S', 'M'],
    values: (e) => {
      const c = (e.components ?? {}) as { v?: boolean; s?: boolean; m?: unknown };
      const o: string[] = [];
      if (c.v) o.push('V');
      if (c.s) o.push('S');
      if (c.m) o.push('M');
      return o;
    }
  },
  { key: 'source', label: 'Source', values: (e) => [String(e.source)] }
];

const ITEM_TYPE_LABELS: Record<string, string> = {
  M: 'Weapon',
  R: 'Weapon',
  A: 'Ammunition',
  LA: 'Armor',
  MA: 'Armor',
  HA: 'Armor',
  S: 'Shield',
  P: 'Potion',
  SC: 'Scroll',
  RG: 'Ring',
  WD: 'Wand',
  RD: 'Rod',
  ST: 'Staff',
  SCF: 'Focus',
  INS: 'Instrument',
  AT: 'Tools',
  T: 'Tools',
  GS: 'Gaming set',
  $: 'Treasure',
  $A: 'Treasure',
  $G: 'Treasure',
  $C: 'Treasure',
  G: 'Gear',
  TG: 'Trade good',
  FD: 'Food',
  EXP: 'Explosive',
  MNT: 'Mount',
  VEH: 'Vehicle',
  OTH: 'Other'
};

export function itemTypeLabel(entry: NamedEntry): string {
  const code = bare(entry.type);
  if (ITEM_TYPE_LABELS[code]) return ITEM_TYPE_LABELS[code];
  if (entry.wondrous) return 'Wondrous';
  return code ? 'Other' : 'Wondrous';
}

const RARITY_ORDER = [
  'none',
  'common',
  'uncommon',
  'rare',
  'very rare',
  'legendary',
  'artifact',
  'varies',
  'unknown',
  'unknown (magic)'
];

const ITEM_FACETS: Facet[] = [
  { key: 'type', label: 'Type', values: (e) => [itemTypeLabel(e)] },
  {
    key: 'rarity',
    label: 'Rarity',
    order: RARITY_ORDER,
    values: (e) => (typeof e.rarity === 'string' ? [e.rarity] : []),
    optionLabel: cap
  },
  {
    key: 'attune',
    label: 'Attunement',
    values: (e) => [e.reqAttune ? 'Requires attunement' : 'No attunement']
  },
  { key: 'source', label: 'Source', values: (e) => [String(e.source)] }
];

const SOURCE_ONLY: Facet[] = [{ key: 'source', label: 'Source', values: (e) => [String(e.source)] }];

export function facetsFor(category: Category): Facet[] {
  if (category === 'spell') return SPELL_FACETS;
  if (category === 'item') return ITEM_FACETS;
  return SOURCE_ONLY;
}
