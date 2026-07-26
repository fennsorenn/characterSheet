import type { BlockInstance, SheetLayout } from './types.js';
import { defaultTemplates, parseTemplateId } from './presets.js';
import { isScreenCategory, type ScreenCategory } from './screen.js';

/**
 * The template library: the fixed built-ins the app ships plus whatever the
 * user has made, with one active and a preferred template per screen size.
 *
 * Built-ins are **not stored** — they are rebuilt from code (see presets.ts), so
 * they can never drift, can never be lost, and always pick up improvements. They
 * are also read-only: editing a block while one is active copies it into the
 * library first and applies the edit to the copy (see {@link editActive}), which
 * is why nothing here mutates a built-in.
 *
 * Pure operations (immutable) keep the whole thing predictable and testable; the
 * store is a thin reactive wrapper that also syncs `layouts` to the server.
 */
export interface LayoutLibrary {
  activeId: string;
  /** The user's own templates. Built-ins are never in here. */
  layouts: SheetLayout[];
  /**
   * Template preferred at each screen-size category, by id — a built-in's or the
   * user's. A character can override these individually, see
   * {@link resolveLayoutId}.
   */
  preferred: Partial<Record<ScreenCategory, string>>;
}

/**
 * The built-ins, built once. They are immutable (every operation here returns a
 * new object), so one shared copy is safe and keeps block identity stable across
 * renders.
 */
const BUILTINS: readonly SheetLayout[] = Object.freeze(defaultTemplates());

export function builtinTemplates(): readonly SheetLayout[] {
  return BUILTINS;
}

/** Whether `id` names a built-in template rather than one of the user's. */
export function isBuiltin(id: string): boolean {
  return parseTemplateId(id) !== null;
}

/** Every template on offer: the built-ins first, then the user's own. */
export function allTemplates(lib: LayoutLibrary): SheetLayout[] {
  return [...BUILTINS, ...lib.layouts];
}

export function findTemplate(lib: LayoutLibrary, id: string): SheetLayout | undefined {
  return allTemplates(lib).find((l) => l.id === id);
}

export function activeLayout(lib: LayoutLibrary): SheetLayout {
  return findTemplate(lib, lib.activeId) ?? BUILTINS[0];
}

/** A name for a copy of `name` that no existing template already uses. */
export function copyName(lib: LayoutLibrary, name: string): string {
  const taken = new Set(allTemplates(lib).map((l) => l.name));
  const base = `${name} (copy)`;
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base} ${i}`)) return `${base} ${i}`;
}

/**
 * Apply a block-level edit to the active template.
 *
 * Built-ins are read-only, so editing one forks it: the edit lands on a fresh
 * copy which becomes active, and every preference that pointed at the built-in
 * is repointed at the copy — otherwise the next screen-size change would snap
 * back to the pristine original and the edit would look lost. (Preferences a
 * *character* holds are repointed by the store, which owns that document.)
 * Editing one of the user's own templates just edits it in place.
 */
export function editActive(
  lib: LayoutLibrary,
  fn: (layout: SheetLayout) => SheetLayout
): LayoutLibrary {
  if (!isBuiltin(lib.activeId)) {
    return { ...lib, layouts: lib.layouts.map((l) => (l.id === lib.activeId ? fn(l) : l)) };
  }
  const source = findTemplate(lib, lib.activeId);
  if (!source) return lib;
  const copy = fn(cloneLayout(source, copyName(lib, source.name)));
  const preferred = { ...lib.preferred };
  for (const [category, target] of Object.entries(preferred)) {
    if (target === source.id) preferred[category as ScreenCategory] = copy.id;
  }
  return { activeId: copy.id, layouts: [...lib.layouts, copy], preferred };
}

/** A fresh, independent copy of a layout (new template id and block ids). */
function cloneLayout(source: SheetLayout, name: string): SheetLayout {
  return {
    id: crypto.randomUUID(),
    name,
    blocks: source.blocks.map((b) => ({ ...b, id: crypto.randomUUID() }))
  };
}

export function selectLayout(lib: LayoutLibrary, id: string): LayoutLibrary {
  return findTemplate(lib, id) ? { ...lib, activeId: id } : lib;
}

/** Add a template and make it active. */
export function addLayout(lib: LayoutLibrary, layout: SheetLayout): LayoutLibrary {
  return { ...lib, activeId: layout.id, layouts: [...lib.layouts, layout] };
}

/**
 * Create a template from a set of blocks (a built-in, a copy, or none) and make
 * it active. Blocks always get fresh ids so the new template is fully
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

/** Rename one of the user's templates. Built-ins keep their shipped names. */
export function renameLayout(lib: LayoutLibrary, id: string, name: string): LayoutLibrary {
  if (isBuiltin(id)) return lib;
  return { ...lib, layouts: lib.layouts.map((l) => (l.id === id ? { ...l, name } : l)) };
}

/**
 * Delete one of the user's templates; built-ins cannot be deleted. Re-points the
 * active template and drops any screen-size preference that named it (a
 * per-character override for a deleted template is ignored at resolve time).
 */
export function deleteLayout(lib: LayoutLibrary, id: string): LayoutLibrary {
  if (isBuiltin(id) || !lib.layouts.some((l) => l.id === id)) return lib;
  const layouts = lib.layouts.filter((l) => l.id !== id);
  const preferred = { ...lib.preferred };
  for (const [category, target] of Object.entries(preferred)) {
    if (target === id) delete preferred[category as ScreenCategory];
  }
  const next = { activeId: lib.activeId, layouts, preferred };
  return lib.activeId === id ? { ...next, activeId: allTemplates(next)[0].id } : next;
}

/** Copy a template (built-in or not) under a new name and make it active. */
export function duplicateLayout(lib: LayoutLibrary, id: string, name: string): LayoutLibrary {
  const source = findTemplate(lib, id);
  return source ? createLayout(lib, name, source.blocks) : lib;
}

/** Designate (or clear, with undefined) the template preferred at a category. */
export function setPreferred(
  lib: LayoutLibrary,
  category: ScreenCategory,
  id: string | undefined
): LayoutLibrary {
  const preferred = { ...lib.preferred };
  if (id && findTemplate(lib, id)) preferred[category] = id;
  else delete preferred[category];
  return { ...lib, preferred };
}

/**
 * Which template a sheet should show at `category`: the character's own choice
 * wins, then the library-wide preference, then whatever is already active. Ids
 * that no longer exist are skipped, so deleting a template never strands a
 * character on a missing layout.
 */
export function resolveLayoutId(
  lib: LayoutLibrary,
  category: ScreenCategory,
  characterPrefs?: Record<string, string>
): string {
  const has = (id: string | undefined): id is string => !!id && !!findTemplate(lib, id);
  const own = characterPrefs?.[category];
  if (has(own)) return own;
  const global = lib.preferred[category];
  if (has(global)) return global;
  return has(lib.activeId) ? lib.activeId : allTemplates(lib)[0].id;
}

/** Drop preference entries with unknown categories or missing templates. */
export function prunePreferred(lib: LayoutLibrary): LayoutLibrary {
  const preferred: LayoutLibrary['preferred'] = {};
  for (const [category, id] of Object.entries(lib.preferred ?? {})) {
    if (isScreenCategory(category) && id && findTemplate(lib, id)) preferred[category] = id;
  }
  return { ...lib, preferred };
}
