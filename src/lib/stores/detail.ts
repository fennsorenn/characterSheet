import { writable } from 'svelte/store';
import type { NamedEntry } from '../data/index.js';

export interface DetailTarget {
  kind: 'spell' | 'item';
  entry: NamedEntry;
  /** Bounding rect of the row/element that opened it, to avoid covering the list. */
  anchor: { x: number; y: number; width: number; height: number } | null;
}

export const detail = writable<DetailTarget | null>(null);

/** Open the detail window for a catalog entry, anchored to the clicked element. */
export function openDetail(kind: 'spell' | 'item', entry: NamedEntry, el?: Element | null) {
  const r = el?.getBoundingClientRect();
  detail.set({ kind, entry, anchor: r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null });
}
export function closeDetail() {
  detail.set(null);
}
