export type { Catalog, Category, NamedEntry, DataReader } from './catalog.js';
export { CATEGORIES, emptyCatalog } from './catalog.js';
export { parseCatalog } from './parse.js';
export { resolveMonsters } from './monsterCopy.js';
export { expandVariants, variantsForBase, hasVariants, isVariant } from './variants.js';
export { readerFromZip, readerFromFiles } from './zip.js';
export { SearchIndex, tokenMatch, type SearchHit, type SearchOptions } from './search.js';
export { dedupeBySource } from './dedupe.js';
export { saveCatalog, loadCachedCatalog, clearCachedCatalogs } from './cache.js';
export { composeCatalog } from './compose.js';
export {
  parseOverlay,
  parseOverlayEntries,
  isEmptyOverlay,
  type Overlay
} from './overlay.js';
export {
  saveOverlay,
  loadOverlays,
  deleteOverlay,
  clearOverlays
} from './overlayCache.js';
export {
  fetchRepoIndex,
  fetchRepoFile,
  supportedProps,
  mergeRepoIndex,
  propsByPath,
  REPO_PRESETS,
  SUPPORTED_PROPS,
  type RepoConfig,
  type RepoSource
} from './repoIndex.js';
export {
  loadFromBytes,
  loadFromFile,
  loadFromUrl,
  type LoadOptions,
  type LoadStage
} from './loader.js';
export {
  facetsFor,
  filterEntries,
  facetOptions,
  itemTypeLabel,
  type Facet,
  type Selection,
  type FacetOption
} from './facets.js';
