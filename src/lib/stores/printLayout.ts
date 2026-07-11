import { writable } from 'svelte/store';
import * as ops from '../layout/operations.js';
import { printDefaultLayout } from '../layout/presets.js';
import type { LayoutController } from '../layout/controller.js';
import type { SheetLayout } from '../layout/types.js';

/**
 * A dedicated, independently-customizable layout used only for printing. It is
 * the same kind of SheetLayout as the screen layouts (so the same editor works
 * on it), persisted separately, and rendered inside the page-sized print sheet.
 */

const STORAGE_KEY = 'charactersheet.printLayout';
const VERSION = 1;

function load(): SheetLayout {
  if (typeof localStorage === 'undefined') return printDefaultLayout();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { version?: number; layout?: SheetLayout };
      if (parsed?.layout?.blocks?.length) return parsed.layout;
    }
  } catch {
    // Fall through to the default print layout.
  }
  return printDefaultLayout();
}

const store = writable<SheetLayout>(load());

store.subscribe((layout) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, layout }));
  }
});

export const printEditMode = writable(false);

const upd = (fn: (l: SheetLayout) => SheetLayout) => store.update(fn);

/** Controller wired to the print layout, consumed by LayoutRenderer/BlockControls. */
export const printController: LayoutController = {
  layout: { subscribe: store.subscribe },
  editMode: { subscribe: printEditMode.subscribe },
  addBlock: (type) => upd((l) => ops.addBlock(l, type)),
  removeBlock: (id) => upd((l) => ops.removeBlock(l, id)),
  moveBlock: (id, dir) => upd((l) => ops.moveBlock(l, id, dir)),
  reorderBlock: (from, to) => upd((l) => ops.reorderBlock(l, from, to)),
  setVariant: (id, variant) => upd((l) => ops.setVariant(l, id, variant)),
  cycleSize: (id) => upd((l) => ops.cycleSize(l, id)),
  setSize: (id, size) => upd((l) => ops.setSize(l, id, size)),
  toggleStack: (id) => upd((l) => ops.toggleStack(l, id)),
  setHeight: (id, height) => upd((l) => ops.setHeight(l, id, height))
};

export const togglePrintEdit = () => printEditMode.update((v) => !v);
export const resetPrintLayout = () => store.set(printDefaultLayout());

/** Replace the print layout, giving every block a fresh id (e.g. copy-from-screen). */
export function adoptLayout(source: SheetLayout) {
  store.set({
    id: 'print',
    name: 'Print',
    blocks: source.blocks.map((b) => ({ ...b, id: crypto.randomUUID() }))
  });
}
