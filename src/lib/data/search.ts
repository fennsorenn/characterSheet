import type { Catalog, Category, NamedEntry } from './catalog.js';

/**
 * Lightweight search index for context-aware quick import (items, spells, …).
 *
 * No external dependency: entries are scored on a linear scan, which is plenty
 * fast for the ~10k-entry catalog when queries are debounced. Ranking favours
 * exact and prefix matches, then word-boundary, then substring, so an
 * autocomplete surfaces the obvious result first.
 */

export interface SearchHit {
  category: Category;
  entry: NamedEntry;
  score: number;
}

interface IndexedEntry {
  category: Category;
  entry: NamedEntry;
  haystack: string; // normalized name
}

export interface SearchOptions {
  /** Restrict to these categories (e.g. only 'item' for an inventory import). */
  categories?: Category[];
  limit?: number;
}

export class SearchIndex {
  private readonly items: IndexedEntry[] = [];

  constructor(catalog: Catalog) {
    for (const category of Object.keys(catalog.entries) as Category[]) {
      // Creatures are reached via references, not quick import; keeping the whole
      // bestiary out of the index avoids burying item/spell hits under monsters.
      if (category === 'monster') continue;
      for (const entry of catalog.entries[category]) {
        // Generated magic-item variants (+1 X, X of Fire Resistance, …) stay in
        // the catalog so an equipped one resolves its effects, but are excluded
        // from search to avoid flooding results — they're added via the
        // per-base "Add variant" picker instead.
        if (entry._isVariant) continue;
        this.items.push({ category, entry, haystack: normalize(entry.name) });
      }
    }
  }

  get size(): number {
    return this.items.length;
  }

  search(query: string, options: SearchOptions = {}): SearchHit[] {
    const q = normalize(query);
    if (!q) return [];
    const allow = options.categories ? new Set(options.categories) : null;
    const limit = options.limit ?? 20;

    const hits: SearchHit[] = [];
    for (const item of this.items) {
      if (allow && !allow.has(item.category)) continue;
      const score = scoreMatch(item.haystack, q);
      if (score > 0) hits.push({ category: item.category, entry: item.entry, score });
    }

    hits.sort(
      (a, b) => b.score - a.score || a.entry.name.length - b.entry.name.length
    );
    return hits.slice(0, limit);
  }
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').trim();
}

/**
 * Order-independent token filter for simple lists (e.g. the variant picker):
 * every whitespace-separated token in `query` must appear in `text`, in any
 * order — so "mail chain" matches "Chain Mail". Empty query matches everything.
 */
export function tokenMatch(text: string, query: string): boolean {
  const h = normalize(text);
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  return tokens.every((t) => h.includes(t));
}

/** Higher is better; 0 means no match. */
function scoreMatch(haystack: string, query: string): number {
  if (haystack === query) return 100;
  if (haystack.startsWith(query)) return 80;
  // Match at a word boundary (after a space, hyphen, etc.).
  const boundary = new RegExp(`(^|[^a-z0-9])${escapeRegExp(query)}`).test(haystack);
  if (boundary) return 60;
  if (haystack.includes(query)) return 40;
  // Token fallback: every whitespace-separated token appears somewhere, in any
  // order — so "mail chain" still finds "Chain Mail". Scored below any
  // whole-query match so contiguous matches always rank first.
  const tokens = query.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every((t) => haystack.includes(t))) return 20;
  return 0;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
