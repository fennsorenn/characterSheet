import type { NamedEntry } from './catalog.js';

/**
 * Magic item variant expansion.
 *
 * `magicvariants.json` does not contain concrete items like "+1 Longsword" — it
 * contains templates that must be combined with matching base items at load
 * time. Each template has:
 *   - `requires`: an OR of match-groups; a base item qualifies if it satisfies
 *     every field in any one group.
 *   - `excludes`: a single match-group that disqualifies a base item.
 *   - `inherits`: properties merged onto the base, plus `namePrefix`/`nameSuffix`
 *     to build the variant name and `{=field}` templates resolved against the
 *     merged result.
 *
 * This is a pragmatic implementation of 5etools' generation: it covers the
 * common requires keys (type, name, source, weaponCategory, property, and the
 * boolean weapon/armor flags) and `{=field}` substitution. Exotic modifiers are
 * left best-effort rather than fully emulated.
 */

interface MagicVariant {
  name?: string;
  requires?: MatchGroup[];
  excludes?: MatchGroup;
  inherits: Record<string, unknown> & {
    namePrefix?: string;
    nameSuffix?: string;
    source?: string;
  };
}

type MatchGroup = Record<string, unknown>;

/** Does a base item satisfy a single match-group (all fields must match)? */
function matchesGroup(base: NamedEntry, group: MatchGroup): boolean {
  return Object.entries(group).every(([key, want]) => {
    const have = base[key];
    if (Array.isArray(have)) return have.includes(want); // e.g. property arrays
    return have === want;
  });
}

function qualifies(base: NamedEntry, variant: MagicVariant): boolean {
  const requires = variant.requires ?? [];
  const required = requires.length === 0 || requires.some((g) => matchesGroup(base, g));
  if (!required) return false;
  if (variant.excludes && matchesGroup(base, variant.excludes)) return false;
  return true;
}

/** Resolve `{=field}` (and `{=field/modifier}`) templates against the item. */
function substitute(value: unknown, item: Record<string, unknown>): unknown {
  if (typeof value === 'string') {
    return value.replace(/\{=([^}]+)\}/g, (_m, expr: string) => {
      const field = expr.split('/')[0]; // ignore modifier suffixes, best-effort
      const resolved = item[field];
      return resolved === undefined || resolved === null ? '' : String(resolved);
    });
  }
  if (Array.isArray(value)) return value.map((v) => substitute(v, item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, substitute(v, item)])
    );
  }
  return value;
}

/** Build one concrete variant item from a base item and a template. */
function buildVariant(base: NamedEntry, variant: MagicVariant): NamedEntry {
  const { namePrefix = '', nameSuffix = '', ...rest } = variant.inherits;
  const merged: Record<string, unknown> = { ...base, ...rest };
  merged.name = `${namePrefix}${base.name}${nameSuffix}`;
  merged.source = variant.inherits.source ?? base.source;
  // Record provenance so the UI can show "variant of <base>", and mark it as a
  // generated variant so the search index can skip it (it stays in the catalog
  // so an equipped variant still resolves its mechanical effects) while the
  // "Add variant" picker surfaces it on demand.
  merged._baseName = base.name;
  merged._baseSource = base.source;
  merged._variantName = variant.name;
  merged._isVariant = true;
  return substitute(merged, merged) as NamedEntry;
}

/**
 * Expand all magic-item templates against the base items, returning the
 * generated variant items (base and pre-made magic items are added separately).
 */
export function expandVariants(
  baseItems: NamedEntry[],
  variants: MagicVariant[]
): NamedEntry[] {
  const out: NamedEntry[] = [];
  for (const variant of variants) {
    if (!variant.inherits) continue;
    for (const base of baseItems) {
      if (qualifies(base, variant)) out.push(buildVariant(base, variant));
    }
  }
  return out;
}

/** True for a generated magic-item variant (as opposed to a base/premade item). */
export function isVariant(entry: NamedEntry): boolean {
  return entry._isVariant === true;
}

/**
 * All generated variants of a given base item, for the "Add variant" picker.
 * Matches on the provenance recorded by {@link buildVariant} (`_baseName` /
 * `_baseSource`), case-insensitively.
 */
export function variantsForBase(
  items: NamedEntry[],
  baseName: string,
  baseSource: string
): NamedEntry[] {
  const n = baseName.toLowerCase();
  const s = baseSource.toLowerCase();
  return items.filter(
    (e) =>
      e._isVariant === true &&
      String(e._baseName ?? '').toLowerCase() === n &&
      String(e._baseSource ?? '').toLowerCase() === s
  );
}

/** True if this base item has at least one generated variant available. */
export function hasVariants(items: NamedEntry[], baseName: string, baseSource: string): boolean {
  const n = baseName.toLowerCase();
  const s = baseSource.toLowerCase();
  return items.some(
    (e) =>
      e._isVariant === true &&
      String(e._baseName ?? '').toLowerCase() === n &&
      String(e._baseSource ?? '').toLowerCase() === s
  );
}
