import { writable, derived, get } from 'svelte/store';
import {
  defaultTemplate,
  starterBlocks,
  templateId,
  type TemplateStyle
} from '../layout/presets.js';
import { SCREEN_CATEGORIES } from '../layout/screen.js';
import { characterLayoutPrefs, setCharacterLayoutPrefs } from './character.js';
import * as ops from '../layout/operations.js';
import * as lib from '../layout/library.js';
import type { LayoutLibrary } from '../layout/library.js';
import type { LayoutController } from '../layout/controller.js';
import type { BlockSize, SheetLayout } from '../layout/types.js';
import type { ScreenCategory } from '../layout/screen.js';
import { me } from './session.js';
import { apiGetTemplates, apiPutTemplates, type TemplateDoc } from '../api/client.js';

/**
 * The template library — the built-ins the app ships plus the user's own — and
 * an edit-mode flag.
 *
 * Built-ins are rebuilt from code and never stored, so only the user's
 * templates are persisted. Those are cached in localStorage (so the app works signed-out and
 * offline) and, once signed in, synced to the server so they follow you between
 * devices. Sync is whole-document last-write-wins on `updatedAt`: simple and
 * predictable, at the cost of not merging two devices edited concurrently
 * while offline.
 *
 * Block-level edits apply to the active template via the pure operations. A
 * built-in is read-only, so editing one forks it into a copy first; the store
 * notices the switch and moves the character's own preferences over too, so the
 * edit doesn't get stranded behind a preference still naming the original.
 */

const STORAGE_KEY = 'charactersheet.layouts';
const LEGACY_KEY = 'charactersheet.layout';
/**
 * v8 introduced per-screen-size preferences; v9 made the shipped templates fixed
 * built-ins that live in code rather than stored copies, so the persisted
 * library holds only what the user made.
 */
const LIBRARY_VERSION = 9;

/**
 * Block types introduced in each library version. On upgrade these are appended
 * (non-destructively) to *every* existing template that lacks them, so a new
 * block reaches returning users on their own templates. Add an entry whenever a
 * new block ships.
 */
const BLOCKS_INTRODUCED: Record<number, string[]> = {
  7: ['traits']
};

/** Each screen size pointed at its built-in for a play style. */
function styleDefaults(style: TemplateStyle): LayoutLibrary['preferred'] {
  const preferred: LayoutLibrary['preferred'] = {};
  for (const category of SCREEN_CATEGORIES) preferred[category] = templateId(category, style);
  return preferred;
}

/**
 * A brand-new library: no templates of the user's own yet, with each screen size
 * preferring its built-in martial arrangement. Martial is the starting point
 * because a fresh character is a level-1 Fighter; a caster switches the four
 * preferences in one click from the template manager, per character or for all.
 */
function fresh(): LayoutLibrary {
  return {
    activeId: templateId('desktop', 'martial'),
    layouts: [],
    preferred: styleDefaults('martial')
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
 * Take stored copies of the built-ins back out of the library (v8 stored them;
 * v9 rebuilds them from code). A copy that still matches what the code ships is
 * simply dropped — the built-in stands in for it, ids and all. One the user had
 * edited is kept as a template of their own under a copy name, and every
 * preference naming it is repointed, so no customisation is lost.
 */
export function unstoreBuiltins(library: LayoutLibrary, fromVersion: number): LayoutLibrary {
  if (fromVersion >= LIBRARY_VERSION) return library;
  const shipped = new Map(lib.builtinTemplates().map((t) => [t.id, t]));
  const layouts: SheetLayout[] = [];
  const renamed = new Map<string, string>();
  for (const layout of library.layouts) {
    const original = shipped.get(layout.id);
    if (!original) {
      layouts.push(layout);
      continue;
    }
    if (sameBlocks(layout, original)) continue; // untouched — the built-in covers it
    const kept: SheetLayout = {
      ...layout,
      id: crypto.randomUUID(),
      name: `${layout.name} (copy)`,
      blocks: layout.blocks.map((b) => ({ ...b, id: crypto.randomUUID() }))
    };
    renamed.set(layout.id, kept.id);
    layouts.push(kept);
  }
  const repoint = (id: string | undefined) => (id && renamed.get(id)) || id;
  const preferred = { ...library.preferred };
  for (const category of SCREEN_CATEGORIES) {
    const next = repoint(preferred[category]);
    if (next) preferred[category] = next;
  }
  return { activeId: repoint(library.activeId)!, layouts, preferred };
}

/** Whether a stored layout still holds exactly the blocks the code ships. */
function sameBlocks(a: SheetLayout, b: SheetLayout): boolean {
  const strip = (l: SheetLayout) =>
    JSON.stringify(l.blocks.map(({ id: _id, ...rest }) => rest));
  return strip(a) === strip(b);
}

/**
 * Normalise anything read from storage or the server into a valid library:
 * stored built-ins retired, preferences pruned to templates that exist, and
 * newly-shipped blocks surfaced on the user's own templates.
 */
export function adoptLibrary(
  parsed: Partial<LayoutLibrary> | undefined,
  fromVersion: number
): LayoutLibrary | null {
  if (!parsed) return null;
  const layouts = (parsed.layouts ?? []).filter((l) => l?.id && Array.isArray(l.blocks));
  const preferred = parsed.preferred ?? {};
  // A document with neither templates nor preferences carries nothing to adopt.
  if (!layouts.length && !Object.keys(preferred).length) return null;
  const library = { activeId: parsed.activeId ?? '', layouts, preferred };
  const adopted = lib.prunePreferred(
    unstoreBuiltins(appendNewBlocks(library, fromVersion), fromVersion)
  );
  return lib.findTemplate(adopted, adopted.activeId)
    ? adopted
    : { ...adopted, activeId: templateId('desktop', 'martial') };
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
/** Lightweight list for the template switcher: built-ins first, then the user's. */
export const layoutList = derived(store, ($s) => ({
  activeId: $s.activeId,
  options: lib.allTemplates($s).map((l) => ({ id: l.id, name: l.name, builtin: lib.isBuiltin(l.id) }))
}));
/** The template preferred at each screen-size category (library-wide). */
export const preferredLayouts = derived(store, ($s) => $s.preferred);
export const editMode = writable(false);

/**
 * Names the copy made the last time an edit forked a built-in, for the notice
 * the sheet shows. Cleared by {@link dismissFork}.
 */
export const forkNotice = writable<{ from: string; to: string; name: string } | null>(null);
export const dismissFork = () => forkNotice.set(null);

/**
 * Undo the fork the notice describes: throw the copy away, and put the active
 * template and every preference that followed it back on the built-in.
 */
export function undoFork() {
  const notice = get(forkNotice);
  if (!notice) return;
  const { from, to } = notice;
  const prefs = get(characterLayoutPrefs);
  if (Object.values(prefs).includes(to)) {
    setCharacterLayoutPrefs(
      Object.fromEntries(Object.entries(prefs).map(([c, id]) => [c, id === to ? from : id]))
    );
  }
  store.update((s) => {
    const preferred = { ...s.preferred };
    for (const [category, target] of Object.entries(preferred)) {
      if (target === to) preferred[category as ScreenCategory] = from;
    }
    return lib.selectLayout(
      { ...s, preferred, layouts: s.layouts.filter((l) => l.id !== to) },
      from
    );
  });
  forkNotice.set(null);
}

// --- Block-level edits (act on the active template) ---
/**
 * Apply an edit to the active template. Editing a built-in forks it, so this
 * also carries the character's own screen-size preferences over to the copy —
 * the library's are repointed by `editActive` itself — and raises the notice
 * telling the user where their edit went.
 */
const onActive = (fn: (l: SheetLayout) => SheetLayout) =>
  store.update((s) => {
    const next = lib.editActive(s, fn);
    if (next.activeId === s.activeId) return next;
    const from = s.activeId;
    const to = next.activeId;
    const prefs = get(characterLayoutPrefs);
    if (Object.values(prefs).includes(from)) {
      setCharacterLayoutPrefs(
        Object.fromEntries(Object.entries(prefs).map(([c, id]) => [c, id === from ? to : id]))
      );
    }
    forkNotice.set({ from, to, name: lib.activeLayout(next).name });
    return next;
  });

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
 * Reset the active template's blocks to a built-in arrangement, keeping its
 * name: the one for the screen size in use, in the play style the template's
 * name still suggests. A built-in is already pristine, so this is a no-op there
 * (and never forks — resetting a built-in to itself would be a strange way to
 * end up with a copy).
 */
export const resetLayout = (category: ScreenCategory = 'desktop') =>
  store.update((s) => {
    if (lib.isBuiltin(s.activeId)) return s;
    const active = lib.activeLayout(s);
    const style: TemplateStyle = /caster/i.test(active.name) ? 'caster' : 'martial';
    const blocks = defaultTemplate(category, style).blocks.map((b) => ({
      ...b,
      id: crypto.randomUUID()
    }));
    return lib.editActive(s, (l) => ({ ...l, blocks }));
  });

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
 * Point every screen size at one play style's built-in — the one-click way to
 * move a whole library (or, per character, one sheet) from martial to caster
 * and back.
 */
export const preferStyle = (style: TemplateStyle) =>
  store.update((s) => ({ ...s, preferred: styleDefaults(style) }));

/** The per-category ids for a play style, for setting a character's own set. */
export function styleLayoutIds(style: TemplateStyle): Record<string, string> {
  return styleDefaults(style) as Record<string, string>;
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
