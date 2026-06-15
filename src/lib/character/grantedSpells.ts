import type { NamedEntry } from '../data/catalog.js';
import type { Character } from './schema.js';

/**
 * Spells granted by equipped items (5etools `attachedSpells`). These appear in
 * the spell list annotated with the granting item, don't count toward
 * learned/prepared limits, and can't be swapped out — they come and go with the
 * item.
 *
 * `attachedSpells` is either a flat list of spell names or nested usage buckets
 * (e.g. `{ daily: { "1": ["fabricate"] } }`); we collect every spell name from
 * the structure and resolve it to a catalog spell for its source/data.
 */

export interface GrantedSpell {
  name: string;
  source: string;
  grantedBy: string;
}

export interface SpellByName {
  getSpellByName(name: string): NamedEntry | undefined;
}
export interface ItemByRef {
  getItem(name: string, source: string): NamedEntry | undefined;
}

/** Clean a 5etools spell reference: "friends#c" → "friends", "fireball|phb" → "fireball". */
function cleanName(s: string): string {
  return s.split('#')[0].split('|')[0].trim();
}

/** Collect every spell name from an `attachedSpells` structure. */
export function attachedSpellNames(attached: unknown): string[] {
  const out = new Set<string>();
  const walk = (x: unknown) => {
    if (typeof x === 'string') {
      const n = cleanName(x);
      if (n) out.add(n);
    } else if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === 'object') Object.values(x).forEach(walk);
  };
  walk(attached);
  return [...out];
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/** Granted spells from a character's equipped items, resolved against the catalog. */
export function grantedSpellsFromItems(
  character: Character,
  lookup: ItemByRef & SpellByName
): GrantedSpell[] {
  const out: GrantedSpell[] = [];
  const seen = new Set<string>();
  for (const inv of character.inventory) {
    if (!inv.equipped) continue;
    const item = lookup.getItem(inv.name, inv.source);
    if (!item?.attachedSpells) continue;
    for (const rawName of attachedSpellNames(item.attachedSpells)) {
      const spell = lookup.getSpellByName(rawName);
      const name = spell?.name ?? titleCase(rawName);
      const source = (spell?.source as string) ?? '';
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name, source, grantedBy: item.name });
    }
  }
  return out;
}
