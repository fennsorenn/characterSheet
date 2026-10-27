import { CUSTOM_SOURCE, type CatalogRef, type Character, type SourceLink } from './schema.js';

/**
 * Which content sources a character depends on, and which of them the catalog
 * currently has.
 *
 * A character names its content by `{name, source}`, so the set of sources it
 * needs is derivable rather than stored — a ref added by any route is counted
 * automatically, and the list can't drift out of date the way a hand-kept one
 * would. What *is* stored on the document is where each source can be fetched
 * from (see {@link SourceLink}), because that is the one part the refs cannot
 * tell us.
 *
 * Source ids are compared case-insensitively throughout: 5etools writes them
 * inconsistently ("PHB" vs "phb") and a case difference must not read as a
 * missing source.
 */

/** Sources that are never fetchable: the player's own entries. */
const UNFETCHABLE = new Set([CUSTOM_SOURCE.toLowerCase()]);

export const sourceKey = (id: string): string => id.trim().toLowerCase();

/** Every `{name, source}` ref on the document, from every field that holds one. */
function allRefs(character: Character): CatalogRef[] {
  const refs: CatalogRef[] = [];
  const push = (r: CatalogRef | undefined | null) => {
    if (r?.source) refs.push(r);
  };

  push(character.race);
  push(character.background);
  for (const c of character.classes ?? []) push(c);
  for (const f of character.feats ?? []) push(f);
  for (const i of character.inventory ?? []) push(i);
  for (const s of character.spells ?? []) push(s);
  for (const rec of [
    character.spellChoices,
    character.optionalChoices,
    character.featChoices
  ]) {
    for (const r of Object.values(rec ?? {})) push(r);
  }
  return refs;
}

/**
 * Distinct source ids the character references, excluding custom entries.
 *
 * Ordered by first appearance so the UI is stable between renders rather than
 * reshuffling as the document is edited.
 */
export function referencedSources(character: Character): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ref of allRefs(character)) {
    const key = sourceKey(ref.source);
    if (!key || UNFETCHABLE.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(ref.source);
  }
  return out;
}

export interface SourceStatus {
  /** The source id as written on the refs. */
  id: string;
  /** Label from the stored link, when there is one. */
  label?: string;
  /** Where to fetch it, when the document knows. */
  url?: string;
  /** Whether the catalog currently has this source loaded. */
  loaded: boolean;
  /** How many refs on the document point at it. */
  refCount: number;
}

/** The stored link for `id`, if the document carries one. */
export function linkFor(character: Character, id: string): SourceLink | undefined {
  const key = sourceKey(id);
  return (character.sources ?? []).find((l) => sourceKey(l.id) === key);
}

/**
 * Every referenced source paired with whether the catalog has it and where to
 * get it. `loaded` is the set of source ids the composed catalog provides —
 * base dataset plus active overlays.
 */
export function sourceStatuses(character: Character, loaded: Iterable<string>): SourceStatus[] {
  const have = new Set([...loaded].map(sourceKey));
  const counts = new Map<string, number>();
  for (const ref of allRefs(character)) {
    const key = sourceKey(ref.source);
    if (!key || UNFETCHABLE.has(key)) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return referencedSources(character).map((id) => {
    const link = linkFor(character, id);
    return {
      id,
      label: link?.label,
      url: link?.url,
      loaded: have.has(sourceKey(id)),
      refCount: counts.get(sourceKey(id)) ?? 0
    };
  });
}

/** Referenced sources the catalog does not currently provide. */
export function missingSources(character: Character, loaded: Iterable<string>): SourceStatus[] {
  return sourceStatuses(character, loaded).filter((s) => !s.loaded);
}

/**
 * Record (or replace) a source link, returning a new document.
 *
 * Keyed case-insensitively on `id` so re-adding a source under different
 * casing updates the existing entry instead of accumulating duplicates — the
 * Features block taught us what duplicate keys cost.
 */
export function setSourceLink(character: Character, link: SourceLink): Character {
  const key = sourceKey(link.id);
  if (!key || !link.url) return character;
  const rest = (character.sources ?? []).filter((l) => sourceKey(l.id) !== key);
  return { ...character, sources: [...rest, link] };
}

/** Drop a stored link by source id. */
export function removeSourceLink(character: Character, id: string): Character {
  const key = sourceKey(id);
  const sources = (character.sources ?? []).filter((l) => sourceKey(l.id) !== key);
  return { ...character, sources };
}
