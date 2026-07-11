import type { NamedEntry } from './catalog.js';

/**
 * Shared entry-coercion used by both the base zip parser ({@link parseCatalog})
 * and the overlay parser ({@link parseOverlayEntries}). Keeping it in one place
 * means the two ingestion paths can't drift on what counts as a valid entry.
 */

/** Coerce an unknown value into the subset of array items that have name+source. */
export function asNamedEntries(value: unknown): NamedEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (e): e is NamedEntry =>
      !!e &&
      typeof e === 'object' &&
      typeof (e as NamedEntry).name === 'string' &&
      typeof (e as NamedEntry).source === 'string'
  );
}
