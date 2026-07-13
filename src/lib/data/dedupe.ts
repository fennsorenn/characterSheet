import type { NamedEntry } from './catalog.js';

/**
 * Collapse cross-source duplicates in favour of a primary source.
 *
 * When a primary source is configured (e.g. "XPHB"), any entry whose name also
 * exists in that source is dropped in favour of the primary one — so the 2024
 * Mace hides the 2014 Mace. Names that don't appear in the primary source at all
 * are left untouched (every source of a primary-less entry still shows).
 *
 * Matching is by name (case-insensitive) within the list it's given, so callers
 * pass a single category's entries. Order is preserved.
 */
export function dedupeBySource<T extends NamedEntry>(
  entries: T[],
  primarySource: string | null | undefined
): T[] {
  if (!primarySource) return entries;
  const primary = primarySource.toLowerCase();
  const isPrimary = (e: NamedEntry) => String(e.source).toLowerCase() === primary;

  // Names that have a primary-source version — their non-primary copies get hidden.
  const covered = new Set<string>();
  for (const e of entries) {
    if (isPrimary(e)) covered.add(e.name.toLowerCase());
  }
  if (covered.size === 0) return entries;

  return entries.filter((e) => isPrimary(e) || !covered.has(e.name.toLowerCase()));
}
