import { unzipSync, strFromU8 } from 'fflate';
import type { DataReader } from './catalog.js';

/**
 * Turn a 5etools release zip into a {@link DataReader} over its `data/` tree.
 *
 * fflate keeps this dependency tiny and works in both the browser and Node (so
 * the same path is exercised in tests against the real release). JSON files are
 * parsed lazily and cached, since a catalog build only touches a fraction of the
 * ~2000 entries in the archive.
 */
export function readerFromZip(bytes: Uint8Array): DataReader {
  const files = unzipSync(bytes, {
    // Only the data tree matters; skip the (large) HTML/JS/image payload.
    filter: (file) => file.name.startsWith('data/') && file.name.endsWith('.json')
  });
  return readerFromFiles(files);
}

/** Build a reader over a map of `data/...`-prefixed file contents. */
export function readerFromFiles(files: Record<string, Uint8Array>): DataReader {
  const cache = new Map<string, unknown>();

  const resolve = (path: string) => `data/${path}`;

  return {
    has: (path) => resolve(path) in files,
    json<T>(path: string): T | undefined {
      const key = resolve(path);
      if (cache.has(key)) return cache.get(key) as T;
      const raw = files[key];
      if (!raw) return undefined;
      const parsed = JSON.parse(strFromU8(raw)) as T;
      cache.set(key, parsed);
      return parsed;
    }
  };
}
