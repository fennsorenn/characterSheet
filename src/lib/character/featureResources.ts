import type { Catalog, NamedEntry } from '../data/catalog.js';
import type { Character, RestType } from './schema.js';
import { ABILITIES, ABILITY_NAMES, type Ability } from './abilities.js';
import { resolveFeatures } from './features.js';

/**
 * Implicit limited-use resources granted by a class/subclass — Channel Divinity,
 * Rage, Wild Shape, Ki/Focus Points, Sorcery Points, Superiority Dice, … These
 * are encoded in the class data's `classTableGroups` as a column whose value at
 * each level is the pool size. We surface the recognised expendable pools (an
 * allowlist, so we don't mistake "Spells Known"/dice-scaler columns for pools)
 * with the size at the character's class level, ready to track alongside the
 * user's manually-added resources.
 *
 * Spent uses are stored separately on the character (`featureResourceUsed`) keyed
 * by a stable key that encodes the recharge, so rests can reset the right ones
 * without needing the catalog.
 */

/** Recognised expendable-pool columns (lowercased label → when it recharges). */
const RESOURCE_COLUMNS: Record<string, RestType> = {
  'channel divinity': 'short',
  rages: 'long',
  'wild shape': 'short',
  'second wind': 'short',
  'ki points': 'short',
  'focus points': 'short',
  'sorcery points': 'long',
  'bardic inspiration': 'long',
  'superiority dice': 'short',
  indomitable: 'long',
  'psi points': 'short',
  'rune knight': 'short'
};

export interface FeatureResource {
  /** Stable key: `${recharge}|${owner}|${label}`. */
  key: string;
  name: string;
  owner: string;
  max: number;
  recharge: RestType;
  /** For a stat-scaled pool: which value drives the max (display only). */
  scaledBy?: Ability | 'prof';
}

const lc = (s: string) => s.toLowerCase();
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const clampLevel = (l: number) => Math.min(Math.max(l, 1), 20);
const strip = (s: string) => s.replace(/\{@\w+\s+([^|}]+)[^}]*\}/g, '$1').trim();
const findClass = (catalog: Catalog, ref: { name: string; source: string }) =>
  catalog.entries.class.find((c) => lc(c.name) === lc(ref.name) && lc(String(c.source)) === lc(ref.source));

/** Pull expendable-pool columns out of one entry's classTableGroups at `level`. */
function fromTableGroups(entry: NamedEntry | undefined, owner: string, level: number, out: FeatureResource[]): void {
  for (const g of arr(entry?.classTableGroups)) {
    const group = g as { colLabels?: unknown; rows?: unknown };
    const labels = arr(group.colLabels).map((l) => strip(String(l)));
    const row = arr(group.rows)[clampLevel(level) - 1];
    if (!Array.isArray(row)) continue;
    labels.forEach((label, idx) => {
      const recharge = RESOURCE_COLUMNS[lc(label)];
      if (!recharge) return;
      const raw = row[idx];
      const val = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
      if (!Number.isFinite(val) || val <= 0) return;
      out.push({ key: `${recharge}|${owner}|${label}`, name: label, owner, max: val, recharge });
    });
  }
}

// --- stat-scaled pools (usage = an ability modifier or proficiency bonus) ---

const flatten = (entries: unknown): string => {
  const parts: string[] = [];
  const walk = (x: unknown) => {
    if (typeof x === 'string') parts.push(x);
    else if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === 'object') {
      const o = x as Record<string, unknown>;
      walk(o.entries);
      walk(o.items);
      walk(o.entry);
    }
  };
  walk(entries);
  return parts.join(' ');
};
const baseName = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, '').trim();
const ABIL_RE = new RegExp(
  `(?:number of times|times|uses?)\\s+equal to your (${ABILITIES.map((a) => ABILITY_NAMES[a]).join('|')}) modifier`,
  'i'
);
const PROF_RE = /(?:number of times|times|uses?)\s+equal to your proficiency bonus/i;
// Fixed counts: "Once per day", "twice per long rest", "3 times per short rest".
const FIXED_RE = /\b(once|twice|(\d+)\s*times)\s+per\s+(day|short rest|long rest)\b/i;

/**
 * Pools described in the feature text rather than the level table: sized by an
 * ability modifier / proficiency bonus (e.g. Bardic Inspiration — "a number of
 * times equal to your Charisma modifier") or a fixed count (e.g. Arcane Recovery
 * — "Once per day"). Stat-sized pools need the live modifiers; fixed ones don't.
 */
function textResources(
  character: Character,
  catalog: Catalog,
  abilityMod: (a: Ability) => number,
  profBonus: number
): FeatureResource[] {
  const out: FeatureResource[] = [];
  const seen = new Set<string>();
  for (const f of resolveFeatures(character, catalog)) {
    // A disabled optional variant contributes nothing until enabled.
    if (f.isVariant && !f.variantEnabled) continue;
    const text = flatten(f.entries);
    let max: number | null = null;
    let scaledBy: Ability | 'prof' | undefined;
    let recharge: RestType = /short(?:\s+or\s+long)?\s+rest/i.test(text) ? 'short' : 'long';

    const abilMatch = text.match(ABIL_RE);
    if (abilMatch) {
      scaledBy = ABILITIES.find((a) => lc(ABILITY_NAMES[a]) === lc(abilMatch[1]))!;
      max = Math.max(1, abilityMod(scaledBy));
    } else if (PROF_RE.test(text)) {
      scaledBy = 'prof';
      max = Math.max(1, profBonus);
    } else {
      const fm = text.match(FIXED_RE);
      if (fm) {
        max = /once/i.test(fm[1]) ? 1 : /twice/i.test(fm[1]) ? 2 : parseInt(fm[2], 10) || 1;
        recharge = /short rest/i.test(fm[3]) ? 'short' : 'long'; // "per day" recharges on a long rest
      }
    }
    if (max == null) continue;

    const name = baseName(f.name);
    const owner = f.subtitle?.replace(/\s+\d+$/, '') ?? f.group;
    const key = `${recharge}|${owner}|${name}`;
    if (seen.has(name.toLowerCase())) continue; // one pool per feature (ignore later upgrades)
    seen.add(name.toLowerCase());
    out.push({ key, name, owner, max, recharge, scaledBy });
  }
  return out;
}

/**
 * All implicit class/subclass resource pools for the character — both fixed
 * level-table pools and stat-scaled ones from feature text. Pass the live ability
 * modifiers / proficiency bonus to size the stat-scaled pools; omit them to get
 * only the table pools (e.g. in pure tests without a graph).
 */
export function featureResources(
  character: Character,
  catalog: Catalog,
  abilityMod?: (a: Ability) => number,
  profBonus?: number
): FeatureResource[] {
  const out: FeatureResource[] = [];
  for (const cls of character.classes) {
    fromTableGroups(findClass(catalog, cls), cls.name, cls.level, out);
    if (cls.subclass) {
      const sc = catalog.classData.subclass.find(
        (s) =>
          lc(String(s.className)) === lc(cls.name) &&
          (lc(String(s.shortName)) === lc(cls.subclass!) || lc(s.name) === lc(cls.subclass!))
      );
      if (sc) fromTableGroups(sc, String(sc.name), cls.level, out);
    }
  }
  if (abilityMod) {
    const tableNames = new Set(out.map((r) => r.name.toLowerCase()));
    for (const r of textResources(character, catalog, abilityMod, profBonus ?? 2)) {
      if (!tableNames.has(r.name.toLowerCase())) out.push(r); // table pool wins on name clash
    }
  }
  // Dedupe by key (a column can repeat across a class's table groups).
  const seen = new Set<string>();
  return out.filter((r) => (seen.has(r.key) ? false : seen.add(r.key)));
}

/** Reset spent feature-resource uses for a rest type (short clears short-only). */
export function resetFeatureResources(used: Record<string, number>, type: RestType): Record<string, number> {
  if (type === 'long') return {};
  const next: Record<string, number> = {};
  for (const [key, n] of Object.entries(used)) {
    if (!key.startsWith('short|')) next[key] = n; // long-rest pools persist through a short rest
  }
  return next;
}
