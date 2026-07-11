import type { NamedEntry } from './catalog.js';

/**
 * Flatten 5etools' base-race + subrace model into single, complete race entries.
 *
 * 5etools stores a playable race as a *base race* plus a *subrace* whose fields
 * merge onto the base (High Elf = Elf + High). The display name is composed, and
 * a nameless subrace is the "standard" variant of its race (standard Human =
 * Human + the nameless +1-all subrace). This app resolves a race as a single
 * catalog entry (one `findRef`), not a base+subrace pair — so we pre-merge here:
 *
 *   - named subrace    → "{raceName} ({name})"   e.g. "Human (Variant)"
 *   - nameless subrace → "{raceName}"            e.g. "Human"
 *
 * Merge rules mirror how the grant resolver reads a race (see gatherFrom):
 * additive array props (ability, entries, proficiencies, resistances, …) are
 * *concatenated* so both base and subrace contributions flow through; scalar
 * props (speed, size, darkvision) take the subrace value when present, else the
 * base's. Base races that have no subrace pass through unchanged.
 */

/** Array props whose base + subrace values concatenate (both apply). */
const ADDITIVE_PROPS = [
  'ability',
  'entries',
  'skillProficiencies',
  'languageProficiencies',
  'weaponProficiencies',
  'armorProficiencies',
  'toolProficiencies',
  'resist',
  'immune',
  'vulnerable',
  'conditionImmune',
  'traitTags',
  'additionalSpells',
  'feats'
];

/** Scalar props where a present subrace value overrides the base. */
const OVERRIDE_PROPS = ['size', 'speed', 'darkvision', 'blindsight', 'truesight', 'tremorsense'];

const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined ? [] : [v]);

/** Compose a subrace's display name the way 5etools does. */
export function subraceDisplayName(raceName: string, subraceName?: unknown): string {
  const sub = typeof subraceName === 'string' ? subraceName.trim() : '';
  return sub ? `${raceName} (${sub})` : raceName;
}

/** Merge one base race with one of its subraces into a complete race entry. */
export function mergeSubrace(base: NamedEntry | undefined, subrace: Record<string, unknown>): NamedEntry {
  const raceName = String(subrace.raceName ?? base?.name ?? 'Race');
  const merged: Record<string, unknown> = { ...(base ?? {}), ...subrace };

  // Name is composed; source follows the subrace (it defines the variant).
  merged.name = subraceDisplayName(raceName, subrace.name);
  merged.source = String(subrace.source ?? base?.source ?? 'UNK');

  // 5etools' `overwrite` marks base props the subrace replaces outright.
  const overwrite = (subrace.overwrite ?? {}) as Record<string, unknown>;

  for (const prop of ADDITIVE_PROPS) {
    if (overwrite[prop]) continue; // subrace value already replaced it via the spread
    const combined = [...asArr(base?.[prop]), ...asArr(subrace[prop])];
    if (combined.length) merged[prop] = combined;
    else delete merged[prop];
  }

  for (const prop of OVERRIDE_PROPS) {
    if (subrace[prop] === undefined && base?.[prop] !== undefined) merged[prop] = base[prop];
  }

  return merged as NamedEntry;
}

/**
 * Turn raw base-race and subrace arrays into the flat race list the catalog
 * uses. Base races with no subrace pass through; those with subraces are
 * represented by their merged children (as in 5etools, you always pick one).
 */
export function flattenRaces(races: NamedEntry[], subraces: Record<string, unknown>[]): NamedEntry[] {
  const key = (name: string, source: string) => `${name.toLowerCase()}|${String(source).toLowerCase()}`;
  const baseByKey = new Map<string, NamedEntry>();
  for (const r of races) baseByKey.set(key(r.name, String(r.source)), r);

  const out: NamedEntry[] = [];
  const basesWithSub = new Set<string>();

  for (const sub of subraces) {
    const raceName = String(sub.raceName ?? '');
    const raceSource = String(sub.raceSource ?? sub.source ?? '');
    const baseKey = key(raceName, raceSource);
    basesWithSub.add(baseKey);
    out.push(mergeSubrace(baseByKey.get(baseKey), sub));
  }

  // Base races that never appear as a subrace's parent are complete on their own.
  for (const r of races) {
    if (!basesWithSub.has(key(r.name, String(r.source)))) out.push(r);
  }
  return out;
}
