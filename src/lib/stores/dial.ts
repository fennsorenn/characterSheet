import { derived, readable, writable } from 'svelte/store';

/**
 * The per-digit value dial: whether it stands in for the on-screen keyboard,
 * and which field it is currently editing.
 *
 * A phone's keyboard covers half the sheet, takes a tap to dismiss, and offers
 * a numeric pad for a number that is nearly always a small nudge from the one
 * already there. The dial edits in place instead. A desktop keyboard has none
 * of those problems, so the default is "auto": on where the pointer is coarse,
 * off where it is not, with the choice overridable either way.
 */

export type DialMode = 'auto' | 'on' | 'off';
export const DIAL_MODES: DialMode[] = ['auto', 'on', 'off'];
export const DIAL_LABELS: Record<DialMode, string> = {
  auto: 'Dial on touch',
  on: 'Dial always',
  off: 'Dial off'
};
export const DIAL_HINTS: Record<DialMode, string> = {
  auto: 'Numbers open the dial where a keyboard would cover the sheet, and type normally elsewhere.',
  on: 'Numbers always open the dial.',
  off: 'Numbers are typed, everywhere.'
};

const KEY = 'charactersheet.dial';

function stored(): DialMode {
  if (typeof localStorage === 'undefined') return 'auto';
  const raw = localStorage.getItem(KEY);
  return raw === 'on' || raw === 'off' || raw === 'auto' ? raw : 'auto';
}

export const dialMode = writable<DialMode>(stored());
dialMode.subscribe((m) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, m);
});

export function cycleDialMode() {
  dialMode.update((m) => DIAL_MODES[(DIAL_MODES.indexOf(m) + 1) % DIAL_MODES.length]);
}

/**
 * A coarse pointer is the best proxy the platform gives for "typing here raises
 * a keyboard over the page" — there is no way to ask about the keyboard itself.
 */
export const coarsePointer = readable(false, (set) => {
  if (typeof matchMedia === 'undefined') return;
  const mql = matchMedia('(pointer: coarse)');
  set(mql.matches);
  const on = () => set(mql.matches);
  mql.addEventListener('change', on);
  return () => mql.removeEventListener('change', on);
});

export const dialEnabled = derived([dialMode, coarsePointer], ([$mode, $coarse]) =>
  $mode === 'on' || ($mode === 'auto' && $coarse)
);

/** The field the dial is open on, or null. */
export interface DialTarget {
  label: string;
  value: number;
  min: number;
  max: number;
  digits: number;
  onchange: (value: number) => void;
}

export const dialTarget = writable<DialTarget | null>(null);

export const openDial = (target: DialTarget) => dialTarget.set(target);
export const closeDial = () => dialTarget.set(null);
