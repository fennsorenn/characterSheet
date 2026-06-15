import type { Catalog, NamedEntry } from '../data/catalog.js';
import type { Character } from './schema.js';
import type { FeatureGroup } from './features.js';

/**
 * Class/subclass "optional feature" choices — Battle Master maneuvers, Warlock
 * invocations, Sorcerer metamagic, fighting styles, etc. These come from a
 * class/subclass's `optionalfeatureProgression` (how many you know at each
 * level) plus the `optionalfeatures` of the matching `featureType`.
 */
export interface OptionalProgression {
  /** Stable key: `${owner}|${source}|${name}`. */
  key: string;
  name: string;
  owner: string;
  group: FeatureGroup;
  featureType: string[];
  /** How many you know at the current level. */
  count: number;
}

const lc = (s: string) => s.toLowerCase();
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const findRef = (list: NamedEntry[], ref: { name: string; source: string }) =>
  list.find((e) => lc(e.name) === lc(ref.name) && lc(String(e.source)) === lc(ref.source));

/** How many are known at `level` (progression values are cumulative totals). */
export function countAtLevel(progression: Record<string, number>, level: number): number {
  let best = 0;
  for (const [k, v] of Object.entries(progression ?? {})) {
    if (Number(k) <= level && v > best) best = v;
  }
  return best;
}

export function featureOptionalProgressions(
  character: Character,
  catalog: Catalog
): OptionalProgression[] {
  const out: OptionalProgression[] = [];
  const addOfp = (owner: string, source: string, group: FeatureGroup, ofp: unknown, level: number) => {
    for (const prog of arr(ofp)) {
      const p = prog as { name?: string; featureType?: string[]; progression?: Record<string, number> };
      const count = countAtLevel(p.progression ?? {}, level);
      if (count <= 0 || !p.name) continue;
      out.push({
        key: `${owner}|${source}|${p.name}`,
        name: p.name,
        owner,
        group,
        featureType: (p.featureType ?? []).map(String),
        count
      });
    }
  };

  for (const cls of character.classes) {
    const classObj = findRef(catalog.entries.class, cls);
    if (classObj?.optionalfeatureProgression)
      addOfp(cls.name, cls.source, 'Class', classObj.optionalfeatureProgression, cls.level);
    if (cls.subclass) {
      const sc = catalog.classData.subclass.find(
        (s) =>
          lc(String(s.className)) === lc(cls.name) &&
          (lc(String(s.shortName)) === lc(cls.subclass!) || lc(s.name) === lc(cls.subclass!))
      );
      if (sc?.optionalfeatureProgression)
        addOfp(String(sc.name), String(sc.source), 'Subclass', sc.optionalfeatureProgression, cls.level);
    }
  }
  return out;
}

/** Optional features whose featureType intersects `types`, deduped by name. */
export function optionalFeaturesOfType(catalog: Catalog, types: string[]): NamedEntry[] {
  const want = new Set(types);
  const seen = new Set<string>();
  return catalog.entries.optionalfeature.filter((o) => {
    if (!arr(o.featureType).some((t) => want.has(String(t)))) return false;
    const k = o.name.toLowerCase();
    return seen.has(k) ? false : seen.add(k);
  });
}
