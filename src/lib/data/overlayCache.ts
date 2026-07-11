import type { Overlay } from './overlay.js';

/**
 * Persist active prerelease/homebrew {@link Overlay}s in IndexedDB, keyed by
 * `sourceId`, so added UA content survives a reload independently of the base
 * catalog (which lives in its own store, see cache.ts). Each overlay is a small
 * parsed document, so storing the parsed result — not re-fetching/re-parsing on
 * startup — keeps launch instant and offline-capable.
 *
 * Shares the `charactersheet` database with the base-catalog cache; the schema
 * version is bumped to 2 to add the `overlays` store. All functions no-op when
 * IndexedDB is unavailable (SSR, tests).
 */

const DB_NAME = 'charactersheet';
const CATALOG_STORE = 'catalog';
const OVERLAY_STORE = 'overlays';
const DB_VERSION = 2;

function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Keep the base-catalog store (created at v1) and add the overlay store.
      if (!db.objectStoreNames.contains(CATALOG_STORE)) db.createObjectStore(CATALOG_STORE);
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
        const request = fn(db.transaction(OVERLAY_STORE, mode).objectStore(OVERLAY_STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
  );
}

/** Store (or replace) one overlay under its source id. */
export async function saveOverlay(overlay: Overlay): Promise<void> {
  if (!hasIndexedDB()) return;
  await tx('readwrite', (s) => s.put(overlay, overlay.sourceId));
}

/** Load every persisted overlay. */
export async function loadOverlays(): Promise<Overlay[]> {
  if (!hasIndexedDB()) return [];
  return tx<Overlay[]>('readonly', (s) => s.getAll());
}

/** Remove one overlay by source id. */
export async function deleteOverlay(sourceId: string): Promise<void> {
  if (!hasIndexedDB()) return;
  await tx('readwrite', (s) => s.delete(sourceId));
}

/** Remove all overlays. */
export async function clearOverlays(): Promise<void> {
  if (!hasIndexedDB()) return;
  await tx('readwrite', (s) => s.clear());
}
