import { writable } from 'svelte/store';
import { defaultLayout } from '../layout/defaultLayout.js';
import * as ops from '../layout/operations.js';
import type { BlockSize, SheetLayout } from '../layout/types.js';

/**
 * The active sheet layout plus an edit-mode flag. The layout is persisted to
 * localStorage so a customised sheet survives reloads. All edits go through the
 * pure operations in layout/operations, keeping mutations predictable.
 */

const STORAGE_KEY = 'charactersheet.layout';

function load(): SheetLayout {
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SheetLayout;
        if (parsed?.blocks?.length) return parsed;
      }
    } catch {
      // Fall back to the default layout.
    }
  }
  return defaultLayout();
}

const store = writable<SheetLayout>(load());

store.subscribe((l) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(l));
  }
});

export const layout = { subscribe: store.subscribe };
export const editMode = writable(false);

export const addBlock = (type: string) => store.update((l) => ops.addBlock(l, type));
export const removeBlock = (id: string) => store.update((l) => ops.removeBlock(l, id));
export const moveBlock = (id: string, dir: -1 | 1) =>
  store.update((l) => ops.moveBlock(l, id, dir));
export const reorderBlock = (fromId: string, toId: string) =>
  store.update((l) => ops.reorderBlock(l, fromId, toId));
export const setVariant = (id: string, variant: string) =>
  store.update((l) => ops.setVariant(l, id, variant));
export const cycleSize = (id: string) => store.update((l) => ops.cycleSize(l, id));
export const setSize = (id: string, size: BlockSize) =>
  store.update((l) => ops.setSize(l, id, size));
export const resetLayout = () => store.set(defaultLayout());
export const toggleEdit = () => editMode.update((v) => !v);
