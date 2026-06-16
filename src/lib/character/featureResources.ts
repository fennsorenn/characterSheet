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

/**
 * Pools whose size is an ability modifier or proficiency bonus, described in the
 * feature text (e.g. Bardic Inspiration — "a number of times equal to your
 * Charisma modifier"). Not in the level table, so we read them from the resolved
 * feature entries. Size is at least 1 (these features specify a minimum of one).
 */
function statResources(
  character: Character,
  catalog: Catalog,
  abilityMod: (a: Ability) => number,
  profBonus: number
): FeatureResource[] {
  const out: FeatureResource[] = [];
  const seen = new Set<string>();
  for (const f of resolveFeatures(character, catalog)) {
    const text = flatten(f.entries);
    const abilMatch = text.match(ABIL_RE);
    const profMatch = !abilMatch && PROF_RE.test(text);
    if (!abilMatch && !profMatch) continue;

    const scaledBy: Ability | 'prof' = abilMatch
      ? (ABILITIES.find((a) => lc(ABILITY_NAMES[a]) === lc(abilMatch[1]))!)
      : 'prof';
    const max = Math.max(1, scaledBy === 'prof' ? profBonus : abilityMod(scaledBy));
    // Recharge: "short rest" (or "short or long") refills on a short rest.
    const recharge: RestType = /short(?:\s+or\s+long)?\s+rest/i.test(text) ? 'short' : 'long';
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
    for (const r of statResources(character, catalog, abilityMod, profBonus ?? 2)) {
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
