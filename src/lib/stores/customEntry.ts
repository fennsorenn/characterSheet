import { writable } from 'svelte/store';
import type { Rect } from '../components/windowShell.js';

/**
 * The item, spell or feature whose own description is open in a window.
 *
 * Kept by name + source rather than by list index, so adding, removing or
 * reordering other entries while the window is open can't silently point it at
 * something else.
 */
export type CustomEntryKind = 'item' | 'spell' | 'feature';

export interface CustomEntryTarget {
  kind: CustomEntryKind;
  name: string;
  source: string;
  anchor: Rect | null;
}

export const customEntry = writable<CustomEntryTarget | null>(null);

export function openCustomEntry(
  kind: CustomEntryKind,
  name: string,
  source: string,
  el?: Element | null
) {
  const r = el?.getBoundingClientRect();
  customEntry.set({
    kind,
    name,
    source,
    anchor: r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null
  });
}

export function closeCustomEntry() {
  customEntry.set(null);
}
