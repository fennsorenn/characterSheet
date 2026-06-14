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
      for (const entry of catalog.entries[category]) {
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

/** Higher is better; 0 means no match. */
function scoreMatch(haystack: string, query: string): number {
  if (haystack === query) return 100;
  if (haystack.startsWith(query)) return 80;
  // Match at a word boundary (after a space, hyphen, etc.).
  const boundary = new RegExp(`(^|[^a-z0-9])${escapeRegExp(query)}`).test(haystack);
  if (boundary) return 60;
  if (haystack.includes(query)) return 40;
  return 0;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
