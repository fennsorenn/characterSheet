import { writable, derived } from 'svelte/store';
import { builtinPresets } from '../layout/presets.js';
import * as ops from '../layout/operations.js';
import * as lib from '../layout/library.js';
import type { LayoutLibrary } from '../layout/library.js';
import type { LayoutController } from '../layout/controller.js';
import type { BlockSize, SheetLayout } from '../layout/types.js';

/**
 * A library of named layouts (with built-in presets) plus an edit-mode flag.
 * Persisted to localStorage. Block-level edits apply to the active layout via
 * the pure operations; library-level actions switch/save/rename/delete layouts.
 */

const STORAGE_KEY = 'charactersheet.layouts';
const LEGACY_KEY = 'charactersheet.layout';
/** Bump when built-in presets change so returning users get the new defaults. */
const LIBRARY_VERSION = 6;
const BUILTIN_IDS = new Set(['default', 'caster', 'martial', 'compact']);

function fresh(): LayoutLibrary {
  return { activeId: 'default', layouts: builtinPresets() };
}

/** Replace built-in presets with the current code versions, keeping custom ones. */
function refreshBuiltins(library: LayoutLibrary): LayoutLibrary {
  const custom = library.layouts.filter((l) => !BUILTIN_IDS.has(l.id));
  const layouts = [...builtinPresets(), ...custom];
  const activeId = layouts.some((l) => l.id === library.activeId) ? library.activeId : 'default';
  return { activeId, layouts };
}

function load(): LayoutLibrary {
  if (typeof localStorage === 'undefined') return fresh();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LayoutLibrary & { version?: number };
      if (parsed?.layouts?.length) {
        const library = { activeId: parsed.activeId, layouts: parsed.layouts };
        // Upgrade stale built-in presets while preserving user-created layouts.
        return parsed.version === LIBRARY_VERSION ? library : refreshBuiltins(library);
      }
    }
    // Migrate a single legacy layout into the new library.
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const old = JSON.parse(legacy) as SheetLayout;
      if (old?.blocks?.length) {
        const migrated: SheetLayout = { ...old, id: crypto.randomUUID(), name: 'My Layout' };
        return { activeId: migrated.id, layouts: [...builtinPresets(), migrated] };
      }
    }
  } catch {
    // Fall through to fresh presets.
  }
  return fresh();
}

const store = writable<LayoutLibrary>(load());

store.subscribe((value) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: LIBRARY_VERSION, ...value }));
  }
});

/** The active layout, rendered by LayoutRenderer. */
export const layout = derived(store, lib.activeLayout);
/** Lightweight list for the preset switcher. */
export const layoutList = derived(store, ($s) => ({
  activeId: $s.activeId,
  options: $s.layouts.map((l) => ({ id: l.id, name: l.name }))
}));
export const editMode = writable(false);

// --- Block-level edits (act on the active layout) ---
const onActive = (fn: (l: SheetLayout) => SheetLayout) =>
  store.update((s) => lib.updateActiveLayout(s, fn));

export const addBlock = (type: string) => onActive((l) => ops.addBlock(l, type));
export const removeBlock = (id: string) => onActive((l) => ops.removeBlock(l, id));
export const moveBlock = (id: string, dir: -1 | 1) => onActive((l) => ops.moveBlock(l, id, dir));
export const reorderBlock = (fromId: string, toId: string) =>
  onActive((l) => ops.reorderBlock(l, fromId, toId));
export const setVariant = (id: string, variant: string) =>
  onActive((l) => ops.setVariant(l, id, variant));
export const cycleSize = (id: string) => onActive((l) => ops.cycleSize(l, id));
export const setSize = (id: string, size: BlockSize) => onActive((l) => ops.setSize(l, id, size));

/** Reset the active layout's blocks to the tuned default arrangement (keeps its name). */
export const resetLayout = () =>
  store.update((s) =>
    lib.updateActiveLayout(s, (l) => ({ ...l, blocks: builtinPresets()[0].blocks }))
  );

// --- Library-level actions ---
export const selectLayout = (id: string) => store.update((s) => lib.selectLayout(s, id));
export const renameLayout = (id: string, name: string) =>
  store.update((s) => lib.renameLayout(s, id, name));
export const deleteLayout = (id: string) => store.update((s) => lib.deleteLayout(s, id));
export const saveAsPreset = (name: string) =>
  store.update((s) => lib.duplicateLayout(s, s.activeId, name));

export const toggleEdit = () => editMode.update((v) => !v);

/** Controller wired to the active screen layout, for LayoutRenderer/BlockControls. */
export const screenController: LayoutController = {
  layout,
  editMode: { subscribe: editMode.subscribe },
  addBlock,
  removeBlock,
  moveBlock,
  reorderBlock,
  setVariant,
  cycleSize
};
