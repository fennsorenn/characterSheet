import type { NamedEntry } from '../data/catalog.js';

/**
 * The rules text behind a condition chip.
 *
 * Conditions are a fixed list in the app (`CONDITIONS`), but their wording is
 * catalog content, so it is looked up by name rather than shipped here. A
 * condition is usually in the data several times over — every printing, plus
 * the reprints — so one has to be chosen: the 2024 book first, because that is
 * the edition the sheet's own rules follow (exhaustion is −2 per level), then
 * the 2014 one, then whatever else carries it.
 */

const EDITION_ORDER = ['XPHB', 'PHB'];

export interface ConditionRule {
  name: string;
  source: string;
  entries: unknown[];
}

const rank = (source: string) => {
  const i = EDITION_ORDER.indexOf(source);
  return i === -1 ? EDITION_ORDER.length : i;
};

const usable = (e: NamedEntry): boolean => Array.isArray(e.entries) && e.entries.length > 0;

/** The best rules entry for one condition name, or null if the catalog has none. */
export function pickConditionRule(entries: NamedEntry[], name: string): ConditionRule | null {
  const want = name.toLowerCase();
  let best: NamedEntry | null = null;
  for (const e of entries) {
    if (e.name.toLowerCase() !== want || !usable(e)) continue;
    if (!best || rank(e.source) < rank(best.source)) best = e;
  }
  return best ? { name: best.name, source: best.source, entries: best.entries as unknown[] } : null;
}

/** Every condition the catalog can explain, keyed by lowercased name. */
export function conditionRuleMap(entries: NamedEntry[]): Map<string, ConditionRule> {
  const out = new Map<string, ConditionRule>();
  for (const e of entries) {
    if (!usable(e)) continue;
    const key = e.name.toLowerCase();
    const have = out.get(key);
    if (!have || rank(e.source) < rank(have.source)) {
      out.set(key, { name: e.name, source: e.source, entries: e.entries as unknown[] });
    }
  }
  return out;
}
