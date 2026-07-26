import { writable } from 'svelte/store';

/**
 * What the dock is showing beyond its always-visible controls.
 *
 * One value, not a set of booleans: opening a creature while the menu is open
 * has to *replace* it, since both fill the same panel. `null` is the resting
 * state — the rail shut on desktop, just the tab row on mobile.
 */
export type DockView =
  | { kind: 'menu' }
  | { kind: 'dice' }
  | { kind: 'creature'; id: string }
  | null;

export const dockView = writable<DockView>(null);

function same(a: DockView, b: DockView): boolean {
  if (!a || !b) return a === b;
  if (a.kind !== b.kind) return false;
  return a.kind === 'creature' && b.kind === 'creature' ? a.id === b.id : true;
}

/** Open a view, or close it if it is already the one showing. */
export function toggleDockView(view: NonNullable<DockView>) {
  dockView.update((current) => (same(current, view) ? null : view));
}

export function openDockView(view: DockView) {
  dockView.set(view);
}

export function closeDock() {
  dockView.set(null);
}
