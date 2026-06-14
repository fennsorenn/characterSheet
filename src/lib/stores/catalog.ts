import { writable, derived, get } from 'svelte/store';
import {
  loadFromFile,
  loadFromUrl,
  loadCachedCatalog,
  clearCachedCatalogs,
  SearchIndex,
  type Catalog,
  type LoadStage
} from '../data/index.js';

/**
 * Reactive wrapper around the data layer. The catalog and its search index live
 * here so any component can react to load state; the heavy lifting stays in the
 * framework-agnostic data modules.
 */

export interface CatalogState {
  catalog: Catalog | null;
  stage: LoadStage | 'idle' | 'error';
  error: string | null;
}

const state = writable<CatalogState>({ catalog: null, stage: 'idle', error: null });

/** Search index rebuilt whenever the catalog changes. */
export const searchIndex = derived(state, ($s) =>
  $s.catalog ? new SearchIndex($s.catalog) : null
);

export const catalogState = { subscribe: state.subscribe };

function track(stage: LoadStage) {
  state.update((s) => ({ ...s, stage }));
}

async function run(load: () => Promise<Catalog>) {
  state.set({ catalog: get(state).catalog, stage: 'downloading', error: null });
  try {
    const catalog = await load();
    state.set({ catalog, stage: 'done', error: null });
  } catch (err) {
    state.set({
      catalog: get(state).catalog,
      stage: 'error',
      error: err instanceof Error ? err.message : String(err)
    });
  }
}

export function importFile(file: File) {
  return run(() => loadFromFile(file, { onProgress: track }));
}

export function importUrl(url: string) {
  return run(() => loadFromUrl(url, { onProgress: track }));
}

/** Restore a previously cached catalog on startup, if present. */
export async function restoreCached() {
  const cached = await loadCachedCatalog();
  if (cached) state.set({ catalog: cached, stage: 'done', error: null });
}

export async function resetCatalog() {
  await clearCachedCatalogs();
  state.set({ catalog: null, stage: 'idle', error: null });
}
