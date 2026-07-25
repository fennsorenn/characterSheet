import { writable, derived, get } from 'svelte/store';
import {
  defaultTemplate,
  defaultTemplates,
  parseTemplateId,
  starterBlocks,
  templateId,
  type TemplateStyle
} from '../layout/presets.js';
import { SCREEN_CATEGORIES } from '../layout/screen.js';
import * as ops from '../layout/operations.js';
import * as lib from '../layout/library.js';
import type { LayoutLibrary } from '../layout/library.js';
import type { LayoutController } from '../layout/controller.js';
import type { BlockSize, SheetLayout } from '../layout/types.js';
import type { ScreenCategory } from '../layout/screen.js';
import { me } from './session.js';
import { apiGetTemplates, apiPutTemplates, type TemplateDoc } from '../api/client.js';

/**
 * The library of layout **templates** — user-created, named block arrangements
 * — plus an edit-mode flag.
 *
 * Templates are cached in localStorage (so the app works signed-out and
 * offline) and, once signed in, synced to the server so they follow you between
 * devices. Sync is whole-document last-write-wins on `updatedAt`: simple and
 * predictable, at the cost of not merging two devices edited concurrently
 * while offline.
 *
 * Block-level edits apply to the active template via the pure operations;
 * library-level actions create/switch/rename/delete templates and designate
 * which one is preferred at each screen-size category.
 */

const STORAGE_KEY = 'charactersheet.layouts';
const LEGACY_KEY = 'charactersheet.layout';
/**
 * v8 retired the four pinned built-in presets: every template is now owned by
 * the user (the presets survive only as starting points for new ones), and the
 * library carries per-screen-size preferences.
 */
const LIBRARY_VERSION = 8;

/**
 * Block types introduced in each library version. On upgrade these are appended
 * (non-destructively) to *every* existing template that lacks them, so a new
 * block reaches returning users on their own templates. Add an entry whenever a
 * new block ships.
 */
const BLOCKS_INTRODUCED: Record<number, string[]> = {
  7: ['traits']
};

/**
 * A brand-new library: every shipped template, with each screen size preferring
 * its own martial arrangement. Martial is the starting point because a fresh
 * character is a level-1 Fighter; a caster switches the four preferences in one
 * click from the template manager, per character or for all of them.
 */
function fresh(): LayoutLibrary {
  const preferred: LayoutLibrary['preferred'] = {};
  for (const category of SCREEN_CATEGORIES) preferred[category] = templateId(category, 'martial');
  return {
    activeId: templateId('desktop', 'martial'),
    layouts: defaultTemplates(),
    preferred
  };
}

/** Append blocks introduced after `fromVersion` to any template missing them. */
export function appendNewBlocks(library: LayoutLibrary, fromVersion: number): LayoutLibrary {
  const introduced = Object.entries(BLOCKS_INTRODUCED)
    .filter(([v]) => Number(v) > fromVersion)
    .flatMap(([, types]) => types);
  if (!introduced.length) return library;
  const layouts = library.layouts.map((l) => {
    let layout = l;
    for (const type of introduced) {
      if (!layout.blocks.some((b) => b.type === type)) layout = ops.addBlock(layout, type);
    }
    return layout;
  });
  return { ...library, layouts };
}

/**
 * Offer the shipped per-screen-size templates to a library that predates them,
 * without touching what the user already has: only ids that are absent are
 * added, and preferences are only seeded when none were set. Runs on the v8
 * upgrade alone — after that, a template the user deleted stays deleted.
 */
export function addShippedTemplates(library: LayoutLibrary, fromVersion: number): LayoutLibrary {
  if (fromVersion >= LIBRARY_VERSION) return library;
  const missing = defaultTemplates().filter((t) => !library.layouts.some((l) => l.id === t.id));
  if (!missing.length) return library;
  const layouts = [...library.layouts, ...missing];
  const preferred = { ...library.preferred };
  if (!Object.keys(preferred).length) {
    for (const category of SCREEN_CATEGORIES) preferred[category] = templateId(category, 'martial');
  }
  return { ...library, layouts, preferred };
}

/**
 * Normalise anything read from storage or the server into a valid library:
 * every template kept as the user's own, the shipped set offered on upgrade,
 * preferences pruned to live templates, and newly-shipped blocks surfaced.
 */
export function adoptLibrary(
  parsed: Partial<LayoutLibrary> | undefined,
  fromVersion: number
): LayoutLibrary | null {
  if (!parsed?.layouts?.length) return null;
  const layouts = parsed.layouts.filter((l) => l?.id && Array.isArray(l.blocks));
  if (!layouts.length) return null;
  const activeId = layouts.some((l) => l.id === parsed.activeId) ? parsed.activeId! : layouts[0].id;
  const library = { activeId, layouts, preferred: parsed.preferred ?? {} };
  return lib.prunePreferred(addShippedTemplates(appendNewBlocks(library, fromVersion), fromVersion));
}

interface Stored {
  version?: number;
  updatedAt?: number;
  library?: LayoutLibrary;
  /** Pre-v8 shape: the library's fields sat at the top level. */
  activeId?: string;
  layouts?: SheetLayout[];
}

function load(): { library: LayoutLibrary; updatedAt: number } {
  if (typeof localStorage === 'undefined') return { library: fresh(), updatedAt: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Stored;
      const source = parsed.library ?? { activeId: parsed.activeId, layouts: parsed.layouts };
      const library = adoptLibrary(source, parsed.version ?? 0);
      if (library) return { library, updatedAt: parsed.updatedAt ?? 0 };
    }
    // Migrate a single legacy layout into the new library.
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const old = JSON.parse(legacy) as SheetLayout;
      if (old?.blocks?.length) {
        const migrated: SheetLayout = { ...old, id: crypto.randomUUID(), name: 'My Layout' };
        return {
          library: { activeId: migrated.id, layouts: [migrated], preferred: {} },
          updatedAt: 0
        };
      }
    }
  } catch {
    // Fall through to a fresh library.
  }
  return { library: fresh(), updatedAt: 0 };
}

const initial = load();
const store = writable<LayoutLibrary>(initial.library);

/** When the library in the store last changed; drives last-write-wins sync. */
let updatedAt = initial.updatedAt;
/** Set while applying a copy pulled from the server, to avoid echoing it back. */
let adopting = false;
let ready = false;
let pushTimer: ReturnType<typeof setTimeout> | undefined;
/** The signed-in user we are syncing with, or null when signed out. */
let syncUser: string | null = null;

function envelope(library: LayoutLibrary): TemplateDoc<LayoutLibrary> {
  return { version: LIBRARY_VERSION, updatedAt, library };
}

function writeLocal(library: LayoutLibrary) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope(library)));
}

/** Push the library to the server, debounced; adopts the server's copy if newer. */
function schedulePush(library: LayoutLibrary) {
  if (!syncUser) return;
  clearTimeout(pushTimer);
  const doc = envelope(library);
  pushTimer = setTimeout(() => {
    apiPutTemplates(doc)
      .then((r) => {
        if (r.stale && r.templates) adopt(r.templates);
      })
      .catch(() => {
        /* offline — localStorage still has it, and the next change retries */
      });
  }, 600);
}

/** Replace the library with a copy from the server, keeping its timestamp. */
function adopt(doc: TemplateDoc<LayoutLibrary>) {
  const library = adoptLibrary(doc.library, doc.version ?? 0);
  if (!library) return;
  adopting = true;
  updatedAt = doc.updatedAt ?? 0;
  store.set(library);
  adopting = false;
}

store.subscribe((library) => {
  if (!ready) return; // the loaded value is already persisted
  if (!adopting) updatedAt = Date.now();
  writeLocal(library);
  if (!adopting) schedulePush(library);
});
ready = true;
writeLocal(initial.library);

/**
 * On sign-in, reconcile with the server: take the remote library if it is newer
 * (or if this device has never saved one), otherwise push ours up. On sign-out
 * we simply stop syncing — the local copy stays as the signed-out library.
 */
me.subscribe((user) => {
  if (user === undefined) return; // still resolving the session
  if (!user) {
    syncUser = null;
    return;
  }
  if (user === syncUser) return;
  syncUser = user;
  apiGetTemplates<LayoutLibrary>()
    .then((r) => {
      if (syncUser !== user) return;
      const remote = r.templates;
      if (remote?.library && (remote.updatedAt ?? 0) > updatedAt) adopt(remote);
      else schedulePush(get(store));
    })
    .catch(() => {
      /* offline — keep using the local copy */
    });
});

/** The active template, rendered by LayoutRenderer. */
export const layout = derived(store, lib.activeLayout);
/** Lightweight list for the template switcher. */
export const layoutList = derived(store, ($s) => ({
  activeId: $s.activeId,
  options: $s.layouts.map((l) => ({ id: l.id, name: l.name }))
}));
/** The template preferred at each screen-size category (library-wide). */
export const preferredLayouts = derived(store, ($s) => $s.preferred);
export const editMode = writable(false);

// --- Block-level edits (act on the active template) ---
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
export const toggleStack = (id: string) => onActive((l) => ops.toggleStack(l, id));
export const setHeight = (id: string, height: number | undefined) =>
  onActive((l) => ops.setHeight(l, id, height));

/**
 * Reset the active template's blocks to a shipped arrangement, keeping its name.
 * A shipped template resets to its own; anything the user made resets to the
 * arrangement for the screen size they are on, keeping its play style if the
 * name still carries one.
 */
export const resetLayout = (category: ScreenCategory = 'desktop') =>
  store.update((s) =>
    lib.updateActiveLayout(s, (l) => {
      const own = parseTemplateId(l.id);
      const style: TemplateStyle = own?.style ?? (/caster/i.test(l.name) ? 'caster' : 'martial');
      return { ...l, blocks: defaultTemplate(own?.category ?? category, style).blocks };
    })
  );

// --- Library-level actions ---
export const selectLayout = (id: string) => store.update((s) => lib.selectLayout(s, id));
export const renameLayout = (id: string, name: string) =>
  store.update((s) => lib.renameLayout(s, id, name));
export const deleteLayout = (id: string) => store.update((s) => lib.deleteLayout(s, id));
export const saveAsPreset = (name: string) =>
  store.update((s) => lib.duplicateLayout(s, s.activeId, name));

/**
 * Create a template named `name` from a starting point: `blank`, `current` (a
 * copy of the active template), or one of the preset arrangements. The new
 * template becomes active.
 */
export const createLayout = (name: string, starter = 'blank') =>
  store.update((s) =>
    lib.createLayout(
      s,
      name,
      starter === 'current' ? lib.activeLayout(s).blocks : starterBlocks(starter)
    )
  );

/** Designate (or clear) the template preferred at a screen-size category. */
export const setPreferredLayout = (category: ScreenCategory, id: string | undefined) =>
  store.update((s) => lib.setPreferred(s, category, id));

/**
 * Point every screen size at one play style's shipped template — the one-click
 * way to move a whole library (or, per character, one sheet) from martial to
 * caster and back.
 */
export const preferStyle = (style: TemplateStyle) =>
  store.update((s) =>
    SCREEN_CATEGORIES.reduce((acc, c) => lib.setPreferred(acc, c, templateId(c, style)), s)
  );

/** The per-category ids for a play style, for setting a character's own set. */
export function styleLayoutIds(style: TemplateStyle): Record<string, string> {
  return Object.fromEntries(SCREEN_CATEGORIES.map((c) => [c, templateId(c, style)]));
}

/**
 * Switch to whichever template wins for `category` — the character's own choice
 * first, then the library-wide preference. A no-op when that is already active,
 * so a manual pick from the switcher survives until the category changes.
 */
export function applyPreferred(category: ScreenCategory, characterPrefs?: Record<string, string>) {
  store.update((s) => {
    const id = lib.resolveLayoutId(s, category, characterPrefs);
    return id === s.activeId ? s : lib.selectLayout(s, id);
  });
}

export const toggleEdit = () => editMode.update((v) => !v);

/** Controller wired to the active screen template, for LayoutRenderer/BlockControls. */
export const screenController: LayoutController = {
  layout,
  editMode: { subscribe: editMode.subscribe },
  addBlock,
  removeBlock,
  moveBlock,
  reorderBlock,
  setVariant,
  cycleSize,
  setSize,
  toggleStack,
  setHeight
};
