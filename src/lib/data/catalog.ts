/**
 * Normalized catalog types.
 *
 * The 5etools data is large and heterogeneous, so entries keep their full
 * original shape (`[key: string]: unknown`) for display, while a small common
 * core (`name`, `source`) is guaranteed for indexing and references. A `Catalog`
 * is the parsed, variant-expanded result the rest of the app consumes; it never
 * ships in the repo — it is built at runtime from user-supplied data.
 */

/** Reference content categories the loader currently understands. */
export type Category =
  | 'spell'
  | 'item'
  | 'feat'
  | 'background'
  | 'race'
  | 'condition'
  | 'action'
  | 'optionalfeature'
  | 'class';

export const CATEGORIES: Category[] = [
  'spell',
  'item',
  'feat',
  'background',
  'race',
  'condition',
  'action',
  'optionalfeature',
  'class'
];

/** Every catalog entry is at least name + source; the rest is category-specific. */
export interface NamedEntry {
  name: string;
  source: string;
  [key: string]: unknown;
}

/** Class feature data, referenced by level for resolving a character's features. */
export interface ClassData {
  classFeature: NamedEntry[];
  subclassFeature: NamedEntry[];
  subclass: NamedEntry[];
}

export interface Catalog {
  /** Identifier for the dataset this catalog was built from (for cache keying). */
  version: string;
  entries: Record<Category, NamedEntry[]>;
  /** Per-category counts, handy for the import summary UI. */
  counts: Record<Category, number>;
  /** Class/subclass feature data (not a browse category). */
  classData: ClassData;
}

/** Read access to the unpacked data tree, paths relative to `data/`. */
export interface DataReader {
  has(path: string): boolean;
  /** Parse a JSON file, or return undefined if it is absent. */
  json<T = unknown>(path: string): T | undefined;
}

export function emptyCatalog(version: string): Catalog {
  const entries = {} as Record<Category, NamedEntry[]>;
  const counts = {} as Record<Category, number>;
  for (const c of CATEGORIES) {
    entries[c] = [];
    counts[c] = 0;
  }
  return {
    version,
    entries,
    counts,
    classData: { classFeature: [], subclassFeature: [], subclass: [] }
  };
}
