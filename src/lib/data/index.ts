export type { Catalog, Category, NamedEntry, DataReader } from './catalog.js';
export { CATEGORIES, emptyCatalog } from './catalog.js';
export { parseCatalog } from './parse.js';
export { expandVariants } from './variants.js';
export { readerFromZip, readerFromFiles } from './zip.js';
export { SearchIndex, type SearchHit, type SearchOptions } from './search.js';
export { saveCatalog, loadCachedCatalog, clearCachedCatalogs } from './cache.js';
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
