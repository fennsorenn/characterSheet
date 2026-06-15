import type { Catalog, NamedEntry } from '../data/catalog.js';
import type { Character } from './schema.js';
import { totalLevel, allFeatRefs } from './schema.js';
import type { GrantedSpell, SpellByName } from './grantedSpells.js';

/**
 * Resolve a character's features for display and for the spells they grant.
 *
 * Class/subclass features are referenced by 5etools string keys
 * ("Name|Class|ClassSrc|Level" / subclass: "Name|Class|ClassSrc|ScShort|ScSrc|Level")
 * into the per-file feature arrays (catalog.classData). Race, background, and
 * feats are catalog entries. We gather everything up to the character's level.
 */

export type FeatureGroup = 'Race' | 'Background' | 'Class' | 'Subclass' | 'Feat';

export interface Feature {
  group: FeatureGroup;
  name: string;
  source: string;
  subtitle?: string;
  level?: number;
  entries: unknown[];
}

const lc = (s: string) => s.toLowerCase();
const findRef = (list: NamedEntry[], ref: { name: string; source: string }) =>
  list.find((e) => lc(e.name) === lc(ref.name) && lc(String(e.source)) === lc(ref.source));

function parseClassFeatureRef(ref: string) {
  const [name = '', className = '', , level = '0'] = ref.split('|');
  return { name, className, level: Number(level) || 0 };
}
function parseSubclassFeatureRef(ref: string) {
  const p = ref.split('|');
  return { name: p[0] ?? '', className: p[1] ?? '', subclassShort: p[3] ?? '', level: Number(p[5]) || 0 };
}

function indexBy(list: NamedEntry[], keyFn: (e: NamedEntry) => string): Map<string, NamedEntry> {
  const m = new Map<string, NamedEntry>();
  for (const e of list) {
    const k = keyFn(e);
    if (!m.has(k)) m.set(k, e);
  }
  return m;
}

/** All resolved features for the character, in display groups. */
export function resolveFeatures(character: Character, catalog: Catalog): Feature[] {
  const out: Feature[] = [];

  if (character.race) {
    const r = findRef(catalog.entries.race, character.race);
    if (r) out.push({ group: 'Race', name: r.name, source: String(r.source), entries: arrEntries(r) });
  }
  if (character.background) {
    const bg = findRef(catalog.entries.background, character.background);
    if (bg) out.push({ group: 'Background', name: bg.name, source: String(bg.source), entries: arrEntries(bg) });
  }
  for (const featRef of allFeatRefs(character)) {
    const f = findRef(catalog.entries.feat, featRef);
    if (f) out.push({ group: 'Feat', name: f.name, source: String(f.source), entries: arrEntries(f) });
  }

  const cfIndex = indexBy(catalog.classData.classFeature, (e) =>
    lc(`${e.name}|${e.className}|${e.level}`)
  );
  const scfIndex = indexBy(catalog.classData.subclassFeature, (e) =>
    lc(`${e.name}|${e.className}|${e.subclassShortName}|${e.level}`)
  );

  for (const cls of character.classes) {
    const classObj = findRef(catalog.entries.class, cls);
    for (const ref of asArray(classObj?.classFeatures)) {
      const refStr = typeof ref === 'string' ? ref : (ref as { classFeature?: string }).classFeature;
      if (!refStr) continue;
      const p = parseClassFeatureRef(refStr);
      if (p.level > cls.level) continue;
      const feat = cfIndex.get(lc(`${p.name}|${p.className}|${p.level}`));
      if (feat) {
        out.push({
          group: 'Class',
          name: feat.name,
          source: String(feat.source),
          level: p.level,
          subtitle: `${cls.name} ${p.level}`,
          entries: arrEntries(feat)
        });
      }
    }
    if (cls.subclass) {
      const sc = catalog.classData.subclass.find(
        (s) =>
          lc(String(s.className)) === lc(cls.name) &&
          (lc(String(s.shortName)) === lc(cls.subclass!) || lc(s.name) === lc(cls.subclass!))
      );
      for (const ref of asArray(sc?.subclassFeatures)) {
        if (typeof ref !== 'string') continue;
        const p = parseSubclassFeatureRef(ref);
        if (p.level > cls.level) continue;
        const feat = scfIndex.get(lc(`${p.name}|${p.className}|${p.subclassShort}|${p.level}`));
        if (feat) {
          out.push({
            group: 'Subclass',
            name: feat.name,
            source: String(feat.source),
            level: p.level,
            subtitle: `${cls.subclass} ${p.level}`,
            entries: arrEntries(feat)
          });
        }
      }
    }
  }
  return out;
}

// --- additionalSpells parsing ---

function cleanName(s: string): string {
  return s.split('#')[0].split('|')[0].trim();
}

/**
 * Collect always-available spell names from an `additionalSpells` block,
 * honouring numeric level gates (≤ charLevel) and skipping `choose` options and
 * the `expanded` (spell-list) bucket.
 */
export function additionalSpellNames(additionalSpells: unknown, charLevel: number): string[] {
  const out = new Set<string>();
  const collect = (v: unknown) => {
    if (typeof v === 'string') {
      const n = cleanName(v);
      if (n) out.add(n);
    } else if (Array.isArray(v)) v.forEach(collect);
    else if (v && typeof v === 'object') {
      if ('choose' in (v as object)) return;
      Object.values(v as object).forEach(collect);
    }
  };
  const gated = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node as object)) {
      if (/^\d+$/.test(k) && Number(k) > charLevel) continue;
      collect(v);
    }
  };
  for (const block of asArray(additionalSpells)) {
    if (!block || typeof block !== 'object') continue;
    const b = block as Record<string, unknown>;
    gated(b.innate);
    gated(b.known);
    gated(b.will);
    gated(b.prepared);
  }
  return [...out];
}

/** Spells granted by feats, race, background, and subclasses (best-effort). */
export function featureGrantedSpells(
  character: Character,
  catalog: Catalog,
  lookup: SpellByName
): GrantedSpell[] {
  const out: GrantedSpell[] = [];
  const seen = new Set<string>();
  const charLevel = totalLevel(character);

  const add = (obj: NamedEntry | undefined, level: number) => {
    if (!obj?.additionalSpells) return;
    for (const raw of additionalSpellNames(obj.additionalSpells, level)) {
      const spell = lookup.getSpellByName(raw);
      const name = spell?.name ?? titleCase(raw);
      const key = lc(name);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name, source: (spell?.source as string) ?? '', grantedBy: obj.name });
    }
  };

  add(character.race && findRef(catalog.entries.race, character.race), charLevel);
  add(character.background && findRef(catalog.entries.background, character.background), charLevel);
  for (const featRef of allFeatRefs(character)) add(findRef(catalog.entries.feat, featRef), charLevel);
  for (const cls of character.classes) {
    if (!cls.subclass) continue;
    const sc = catalog.classData.subclass.find(
      (s) =>
        lc(String(s.className)) === lc(cls.name) &&
        (lc(String(s.shortName)) === lc(cls.subclass!) || lc(s.name) === lc(cls.subclass!))
    );
    add(sc, cls.level);
  }
  return out;
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function arrEntries(e: NamedEntry): unknown[] {
  return Array.isArray(e.entries) ? e.entries : [];
}
