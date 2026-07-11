import { writable, derived } from 'svelte/store';
import {
  loadFromFile,
  loadFromUrl,
  loadCachedCatalog,
  clearCachedCatalogs,
  SearchIndex,
  composeCatalog,
  parseOverlay,
  isEmptyOverlay,
  saveOverlay,
  loadOverlays,
  deleteOverlay,
  clearOverlays,
  fetchRepoFile,
  type Overlay,
  type RepoConfig,
  type RepoSource,
  type Catalog,
  type NamedEntry,
  type LoadStage
} from '../data/index.js';

/**
 * Reactive wrapper around the data layer. Holds the base catalog plus any active
 * prerelease/homebrew overlays, and composes them into the single catalog every
 * consumer (search, lookups, calc graph) reads. The heavy lifting stays in the
 * framework-agnostic data modules.
 */

export interface CatalogState {
  /** The base dataset (5etools release), before overlays. */
  base: Catalog | null;
  /** Active prerelease/homebrew overlays layered on top of the base. */
  overlays: Overlay[];
  stage: LoadStage | 'idle' | 'error';
  error: string | null;
}

const state = writable<CatalogState>({ base: null, overlays: [], stage: 'idle', error: null });

/** The composed catalog: base + overlays. Null until a base dataset is loaded. */
const composed = derived(state, ($s) =>
  $s.base ? composeCatalog($s.base, $s.overlays) : null
);

/** Search index rebuilt whenever the composed catalog changes. */
export const searchIndex = derived(composed, ($c) => ($c ? new SearchIndex($c) : null));

const itemKey = (name: string, source: string) =>
  `${name.toLowerCase()}|${source.toLowerCase()}`;

/**
 * Item lookup for the calc graph — equipped items resolve their mechanical
 * effects (armor AC, magic bonuses) through this. Rebuilt with the catalog.
 */
export const catalogLookup = derived(composed, ($c) => {
  const items = new Map<string, NamedEntry>();
  const feats = new Map<string, NamedEntry>();
  const spells = new Map<string, NamedEntry>();
  const spellsByName = new Map<string, NamedEntry>();
  const creatures = new Map<string, NamedEntry>();
  const creaturesByName = new Map<string, NamedEntry>();
  if ($c) {
    for (const item of $c.entries.item) items.set(itemKey(item.name, item.source), item);
    for (const feat of $c.entries.feat) feats.set(itemKey(feat.name, feat.source), feat);
    for (const spell of $c.entries.spell) {
      spells.set(itemKey(spell.name, spell.source), spell);
      const n = spell.name.toLowerCase();
      if (!spellsByName.has(n)) spellsByName.set(n, spell); // first wins
    }
    for (const m of $c.entries.monster ?? []) {
      creatures.set(itemKey(m.name, m.source), m);
      const n = m.name.toLowerCase();
      if (!creaturesByName.has(n)) creaturesByName.set(n, m); // first wins
    }
  }
  return {
    getItem: (name: string, source: string) => items.get(itemKey(name, source)),
    getFeat: (name: string, source: string) => feats.get(itemKey(name, source)),
    getSpell: (name: string, source: string) => spells.get(itemKey(name, source)),
    getSpellByName: (name: string) => spellsByName.get(name.toLowerCase()),
    getCreature: (name: string, source: string) => creatures.get(itemKey(name, source)),
    getCreatureByName: (name: string) => creaturesByName.get(name.toLowerCase())
  };
});

/**
 * Back-compat façade: consumers read `$catalogState.catalog` (the composed
 * catalog) exactly as before overlays existed, plus `overlays` for the manager.
 */
export const catalogState = derived([state, composed], ([$s, $c]) => ({
  catalog: $c,
  overlays: $s.overlays,
  stage: $s.stage,
  error: $s.error
}));

function track(stage: LoadStage) {
  state.update((s) => ({ ...s, stage }));
}

async function run(load: () => Promise<Catalog>) {
  state.update((s) => ({ ...s, stage: 'downloading', error: null }));
  try {
    const base = await load();
    state.update((s) => ({ ...s, base, stage: 'done', error: null }));
  } catch (err) {
    state.update((s) => ({
      ...s,
      stage: 'error',
      error: err instanceof Error ? err.message : String(err)
    }));
  }
}

export function importFile(file: File) {
  return run(() => loadFromFile(file, { onProgress: track }));
}

export function importUrl(url: string) {
  return run(() => loadFromUrl(url, { onProgress: track }));
}

/** Restore a previously cached base catalog and overlays on startup, if present. */
export async function restoreCached() {
  const [base, overlays] = await Promise.all([loadCachedCatalog(), loadOverlays()]);
  state.update((s) => ({
    ...s,
    base: base ?? s.base,
    overlays: overlays.length ? overlays : s.overlays,
    stage: base ? 'done' : s.stage
  }));
}

export async function resetCatalog() {
  await clearCachedCatalogs();
  state.update((s) => ({ ...s, base: null, stage: 'idle', error: null }));
}

// ── Overlay (prerelease/homebrew) management ────────────────────────────────

/** Add an overlay from an already-parsed document, persisting and activating it. */
async function addOverlay(overlay: Overlay): Promise<void> {
  await saveOverlay(overlay);
  state.update((s) => ({
    ...s,
    // Replace any existing overlay with the same source id.
    overlays: [...s.overlays.filter((o) => o.sourceId !== overlay.sourceId), overlay]
  }));
}

/** Fetch a source from a repo index, parse it, and activate it as an overlay. */
export async function addOverlayFromRepo(config: RepoConfig, source: RepoSource): Promise<void> {
  const doc = await fetchRepoFile(config, source.path);
  const overlay = parseOverlay(doc, source.sourceId, source.name);
  if (isEmptyOverlay(overlay)) {
    throw new Error(`"${source.name}" has no content this app can use.`);
  }
  await addOverlay(overlay);
}

/** Parse a user-picked JSON file and activate it as an overlay. */
export async function addOverlayFromFile(file: File): Promise<void> {
  const doc = JSON.parse(await file.text()) as Record<string, unknown>;
  // Prefer the file's declared source id; fall back to the filename.
  const meta = (doc._meta as { sources?: { json?: string; full?: string }[] } | undefined);
  const src = meta?.sources?.[0];
  const sourceId = src?.json ?? file.name.replace(/\.json$/i, '');
  const overlay = parseOverlay(doc, sourceId, src?.full ?? sourceId);
  if (isEmptyOverlay(overlay)) {
    throw new Error(`"${file.name}" has no content this app can use.`);
  }
  await addOverlay(overlay);
}

/** Remove an active overlay by source id. */
export async function removeOverlay(sourceId: string): Promise<void> {
  await deleteOverlay(sourceId);
  state.update((s) => ({ ...s, overlays: s.overlays.filter((o) => o.sourceId !== sourceId) }));
}

/** Remove all overlays. */
export async function removeAllOverlays(): Promise<void> {
  await clearOverlays();
  state.update((s) => ({ ...s, overlays: [] }));
}
