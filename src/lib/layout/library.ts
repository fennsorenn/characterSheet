import type { BlockInstance, SheetLayout } from './types.js';
import { isScreenCategory, type ScreenCategory } from './screen.js';

/**
 * A library of named templates with one active, plus a preferred template per
 * screen-size category. Every template is user-owned: there are no fixed
 * built-ins, only starting points you can copy from (see presets.ts).
 *
 * Pure operations (immutable) keep creating, switching, saving, renaming, and
 * deleting predictable and testable. The store is a thin reactive wrapper over
 * these, and syncs the whole library to the server so it follows you between
 * devices.
 */
export interface LayoutLibrary {
  activeId: string;
  layouts: SheetLayout[];
  /**
   * Template preferred at each screen-size category. A character can override
   * these individually — see {@link resolveLayoutId}.
   */
  preferred: Partial<Record<ScreenCategory, string>>;
}

export function activeLayout(lib: LayoutLibrary): SheetLayout {
  return lib.layouts.find((l) => l.id === lib.activeId) ?? lib.layouts[0];
}

/** Apply a layout transform to the active layout only. */
export function updateActiveLayout(
  lib: LayoutLibrary,
  fn: (layout: SheetLayout) => SheetLayout
): LayoutLibrary {
  return {
    ...lib,
    layouts: lib.layouts.map((l) => (l.id === lib.activeId ? fn(l) : l))
  };
}

export function selectLayout(lib: LayoutLibrary, id: string): LayoutLibrary {
  return lib.layouts.some((l) => l.id === id) ? { ...lib, activeId: id } : lib;
}

/** Add a layout and make it active. */
export function addLayout(lib: LayoutLibrary, layout: SheetLayout): LayoutLibrary {
  return { ...lib, activeId: layout.id, layouts: [...lib.layouts, layout] };
}

/**
 * Create a template from a set of blocks (a starter preset, a copy, or none)
 * and make it active. Blocks always get fresh ids so the new template is fully
 * independent of whatever it was seeded from.
 */
export function createLayout(
  lib: LayoutLibrary,
  name: string,
  blocks: BlockInstance[] = []
): LayoutLibrary {
  const layout: SheetLayout = {
    id: crypto.randomUUID(),
    name: name.trim() || 'Untitled',
    blocks: blocks.map((b) => ({ ...b, id: crypto.randomUUID() }))
  };
  return addLayout(lib, layout);
}

export function renameLayout(lib: LayoutLibrary, id: string, name: string): LayoutLibrary {
  return { ...lib, layouts: lib.layouts.map((l) => (l.id === id ? { ...l, name } : l)) };
}

/**
 * Delete a template; never removes the last one. Re-points the active template
 * and drops any screen-size preference that pointed at it (a per-character
 * override for a deleted template is ignored at resolve time).
 */
export function deleteLayout(lib: LayoutLibrary, id: string): LayoutLibrary {
  if (lib.layouts.length <= 1) return lib;
  const layouts = lib.layouts.filter((l) => l.id !== id);
  const activeId = lib.activeId === id ? layouts[0].id : lib.activeId;
  const preferred = { ...lib.preferred };
  for (const [category, target] of Object.entries(preferred)) {
    if (target === id) delete preferred[category as ScreenCategory];
  }
  return { activeId, layouts, preferred };
}

/** Copy a template (fresh ids) under a new name and make it active. */
export function duplicateLayout(
  lib: LayoutLibrary,
  id: string,
  name: string
): LayoutLibrary {
  const source = lib.layouts.find((l) => l.id === id);
  if (!source) return lib;
  return createLayout(lib, name, source.blocks);
}

/** Designate (or clear, with undefined) the template preferred at a category. */
export function setPreferred(
  lib: LayoutLibrary,
  category: ScreenCategory,
  id: string | undefined
): LayoutLibrary {
  const preferred = { ...lib.preferred };
  if (id && lib.layouts.some((l) => l.id === id)) preferred[category] = id;
  else delete preferred[category];
  return { ...lib, preferred };
}

/**
 * Which template a sheet should show at `category`: the character's own choice
 * wins, then the library-wide preference, then whatever is already active.
 * Ids that no longer exist are skipped, so deleting a template never strands a
 * character on a missing layout.
 */
export function resolveLayoutId(
  lib: LayoutLibrary,
  category: ScreenCategory,
  characterPrefs?: Record<string, string>
): string {
  const has = (id: string | undefined): id is string =>
    !!id && lib.layouts.some((l) => l.id === id);
  const own = characterPrefs?.[category];
  if (has(own)) return own;
  const global = lib.preferred[category];
  if (has(global)) return global;
  return has(lib.activeId) ? lib.activeId : lib.layouts[0].id;
}

/** Drop preference entries with unknown categories or missing templates. */
export function prunePreferred(lib: LayoutLibrary): LayoutLibrary {
  const preferred: LayoutLibrary['preferred'] = {};
  for (const [category, id] of Object.entries(lib.preferred ?? {})) {
    if (isScreenCategory(category) && lib.layouts.some((l) => l.id === id)) {
      preferred[category] = id;
    }
  }
  return { ...lib, preferred };
}
