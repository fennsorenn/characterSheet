import { writable, derived } from 'svelte/store';

/**
 * How much of the sheet is editable right now.
 *
 *   edit  everything — building or levelling a character
 *   play  only what changes during a session: current HP, spell slots, uses,
 *         conditions, notes. What the character *is* stays put, so a stray
 *         click can't quietly rewrite an ability score mid-fight.
 *   read  nothing. Values can still be rolled, traced and expanded — reading a
 *         sheet is not editing it.
 *
 * This is a preference about the viewer, not a fact about the character, so it
 * lives beside the other UI state and persists per browser rather than on the
 * document.
 */
export type SheetMode = 'edit' | 'play' | 'read';

export const SHEET_MODES: SheetMode[] = ['edit', 'play', 'read'];

export const MODE_LABELS: Record<SheetMode, string> = {
  edit: 'Edit',
  play: 'Play',
  read: 'Read'
};

export const MODE_HINTS: Record<SheetMode, string> = {
  edit: 'Everything is editable.',
  play: 'Only what changes during play — HP, slots, uses, conditions, notes.',
  read: 'Locked. Rolling and tracing still work.'
};

const KEY = 'charactersheet.mode';

function initial(): SheetMode {
  if (typeof localStorage === 'undefined') return 'edit';
  const stored = localStorage.getItem(KEY);
  return stored === 'play' || stored === 'read' || stored === 'edit' ? stored : 'edit';
}

export const sheetMode = writable<SheetMode>(initial());

sheetMode.subscribe((m) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, m);
});

export function setSheetMode(mode: SheetMode) {
  sheetMode.set(mode);
}

/** Step to the next mode: edit → play → read → edit. */
export function cycleSheetMode() {
  sheetMode.update((m) => SHEET_MODES[(SHEET_MODES.indexOf(m) + 1) % SHEET_MODES.length]);
}

/**
 * What the character *is*: ability scores, max HP, class levels, proficiencies,
 * what is in the pack. Editable only in edit mode.
 */
export const canEditBuild = derived(sheetMode, (m) => m === 'edit');

/**
 * What the character currently *has*: hit points, expended slots and uses,
 * conditions, notes. Editable in play as well — that is the point of play mode.
 */
export const canEditPlay = derived(sheetMode, (m) => m !== 'read');
