import { writable } from 'svelte/store';

/**
 * App-wide preferences that aren't tied to a single character: which source to
 * treat as canonical (to hide cross-source duplicates), and how the spell list
 * surfaces material components. Persisted to localStorage so they stick between
 * sessions.
 */

/** How the spell list shows costly material components. */
export type SpellMaterialDisplay = 'off' | 'always' | 'consumed';

export interface Settings {
  /**
   * The canonical source (e.g. "XPHB"). When set, an entry that also exists in
   * this source is hidden everywhere its non-primary duplicate would appear
   * (search, browse, option pickers) — so the 2024 mace wins over the 2014 one.
   * null = show every source.
   */
  primarySource: string | null;
  /** Show costly material components in the spell list: never / all / consumed-only. */
  spellMaterialDisplay: SpellMaterialDisplay;
}

const KEY = 'charactersheet.settings';

const DEFAULTS: Settings = { primarySource: null, spellMaterialDisplay: 'off' };

function load(): Settings {
  if (typeof localStorage === 'undefined') return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings = writable<Settings>(load());

settings.subscribe((s) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(s));
});

export function setPrimarySource(source: string | null) {
  settings.update((s) => ({ ...s, primarySource: source || null }));
}

export function setSpellMaterialDisplay(mode: SpellMaterialDisplay) {
  settings.update((s) => ({ ...s, spellMaterialDisplay: mode }));
}
