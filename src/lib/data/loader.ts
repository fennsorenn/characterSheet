import type { Catalog } from './catalog.js';
import { readerFromZip } from './zip.js';
import { parseCatalog } from './parse.js';
import { saveCatalog } from './cache.js';

/**
 * Orchestrates turning user-supplied data into a cached {@link Catalog}.
 *
 * Three entry points — raw bytes, a picked File, or a URL — all funnel through
 * the same parse + cache path. URL loading goes via the app's own `/api/fetch`
 * proxy so a cross-origin release zip (e.g. a GitHub release asset) isn't
 * blocked by CORS; the proxy streams the bytes back to the browser.
 */

export interface LoadOptions {
  /** Label stored as the catalog version (filename, URL, or hash). */
  version?: string;
  /** Persist to IndexedDB after parsing. Default true. */
  cache?: boolean;
  /** Progress callback for UI ("Downloading…", "Parsing…"). */
  onProgress?: (stage: LoadStage) => void;
}

export type LoadStage = 'downloading' | 'unpacking' | 'parsing' | 'caching' | 'done';

export async function loadFromBytes(
  bytes: Uint8Array,
  options: LoadOptions = {}
): Promise<Catalog> {
  const { version = `dataset-${bytes.length}`, cache = true, onProgress } = options;

  onProgress?.('unpacking');
  const reader = readerFromZip(bytes);

  onProgress?.('parsing');
  const catalog = parseCatalog(reader, version);

  if (cache) {
    onProgress?.('caching');
    await saveCatalog(catalog);
  }
  onProgress?.('done');
  return catalog;
}

export async function loadFromFile(file: File, options: LoadOptions = {}): Promise<Catalog> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return loadFromBytes(bytes, { version: file.name, ...options });
}

/**
 * Fetch a release zip by URL. Tries a direct fetch first (works if the host
 * sends CORS headers), then falls back to the server-side proxy.
 */
export async function loadFromUrl(url: string, options: LoadOptions = {}): Promise<Catalog> {
  options.onProgress?.('downloading');
  const bytes = await fetchZip(url);
  return loadFromBytes(bytes, { version: url, ...options });
}

async function fetchZip(url: string): Promise<Uint8Array> {
  try {
    const direct = await fetch(url);
    if (direct.ok) return new Uint8Array(await direct.arrayBuffer());
  } catch {
    // CORS or network failure — fall through to the proxy.
  }
  const proxied = await fetch(`/api/fetch?url=${encodeURIComponent(url)}`);
  if (!proxied.ok) {
    throw new Error(`Failed to fetch dataset (${proxied.status} ${proxied.statusText})`);
  }
  return new Uint8Array(await proxied.arrayBuffer());
}
