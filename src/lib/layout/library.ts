import type { SheetLayout } from './types.js';

/**
 * A library of named layouts with one active. Pure operations (immutable) keep
 * switching, saving, renaming, and deleting predictable and testable. The store
 * is a thin reactive wrapper over these.
 */
export interface LayoutLibrary {
  activeId: string;
  layouts: SheetLayout[];
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
  return { activeId: layout.id, layouts: [...lib.layouts, layout] };
}

export function renameLayout(lib: LayoutLibrary, id: string, name: string): LayoutLibrary {
  return { ...lib, layouts: lib.layouts.map((l) => (l.id === id ? { ...l, name } : l)) };
}

/** Delete a layout; never removes the last one. Re-points active if needed. */
export function deleteLayout(lib: LayoutLibrary, id: string): LayoutLibrary {
  if (lib.layouts.length <= 1) return lib;
  const layouts = lib.layouts.filter((l) => l.id !== id);
  const activeId = lib.activeId === id ? layouts[0].id : lib.activeId;
  return { activeId, layouts };
}

/** Copy a layout (fresh ids) under a new name and make it active. */
export function duplicateLayout(
  lib: LayoutLibrary,
  id: string,
  name: string
): LayoutLibrary {
  const source = lib.layouts.find((l) => l.id === id);
  if (!source) return lib;
  const copy: SheetLayout = {
    id: crypto.randomUUID(),
    name,
    blocks: source.blocks.map((b) => ({ ...b, id: crypto.randomUUID() }))
  };
  return addLayout(lib, copy);
}
