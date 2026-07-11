import type { Catalog } from './catalog.js';

/**
 * Persist the parsed catalog in IndexedDB so a reload is instant and the app
 * works offline once data has been supplied. The whole catalog is stored under
 * its version key via structured clone; parsing the zip again is only needed
 * when the user supplies a different dataset.
 *
 * All functions no-op gracefully when IndexedDB is unavailable (SSR, tests).
 */

const DB_NAME = 'charactersheet';
const STORE = 'catalog';
const OVERLAY_STORE = 'overlays';
const CURRENT_KEY = '__current__';
// Bumped to 2 to add the `overlays` store (see overlayCache.ts). Both modules
// open the shared database at the same version with the same upgrade so neither
// blocks the other's schema.
const DB_VERSION = 2;

function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(OVERLAY_STORE)) db.createObjectStore(OVERLAY_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = fn(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
  );
}

/** Store the catalog under both its version and the "current" pointer. */
export async function saveCatalog(catalog: Catalog): Promise<void> {
  if (!hasIndexedDB()) return;
  await tx('readwrite', (s) => s.put(catalog, catalog.version));
  await tx('readwrite', (s) => s.put(catalog.version, CURRENT_KEY));
}

/** Load the most recently saved catalog, if any. */
export async function loadCachedCatalog(): Promise<Catalog | undefined> {
  if (!hasIndexedDB()) return undefined;
  const version = await tx<string | undefined>('readonly', (s) => s.get(CURRENT_KEY));
  if (!version) return undefined;
  return tx<Catalog | undefined>('readonly', (s) => s.get(version));
}

export async function clearCachedCatalogs(): Promise<void> {
  if (!hasIndexedDB()) return;
  await tx('readwrite', (s) => s.clear());
}
