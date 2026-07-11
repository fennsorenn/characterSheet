/**
 * Browse a 5etools content repository (prerelease/UA or homebrew) by its
 * `_generated` index, the same way the 5etools "Get Homebrew" flow does.
 *
 * A repo publishes three index files we merge into a browsable source list:
 *   - `index-sources.json`  — { sourceId: path }             (what to fetch, and its tag)
 *   - `index-meta.json`     — { basename: { n, a, e } }      (display names + abbreviations)
 *   - `index-props.json`    — { prop: { path: prop } }        (which content each file holds)
 *
 * Note the keying quirk: sources/props key by full repo path, meta keys by the
 * file's basename. Fetches go direct first (raw.githubusercontent sends CORS
 * headers) and fall back to the app's `/api/fetch` proxy, mirroring the loader.
 */

export interface RepoConfig {
  owner: string;
  repo: string;
  /** Default branch of the repo (raw file host needs it explicitly). */
  branch: string;
  /** Label for the picker. */
  label: string;
}

/** Known content repos, presets for the manager UI. */
export const REPO_PRESETS: RepoConfig[] = [
  {
    owner: 'TheGiddyLimit',
    repo: 'unearthed-arcana',
    branch: 'master',
    label: 'Unearthed Arcana (official prerelease)'
  },
  {
    owner: 'TheGiddyLimit',
    repo: 'homebrew',
    branch: 'master',
    label: 'Homebrew collection'
  }
];

/** One addable source from a repo index. */
export interface RepoSource {
  /** Source id / tag (e.g. "XUA2025Psion"). */
  sourceId: string;
  /** Repo-relative path to the JSON file. */
  path: string;
  /** Best display name (from meta), falling back to the source id. */
  name: string;
  /** Source abbreviations from meta, if any. */
  abbreviations: string[];
  /** Content props this file carries (e.g. "subclass", "spell", "feat"). */
  props: string[];
}

interface SourcesIndex {
  [sourceId: string]: string;
}
interface MetaIndex {
  [basename: string]: { n?: string[]; a?: string[]; e?: number };
}
/** prop -> { path -> prop } */
interface PropsIndex {
  [prop: string]: { [path: string]: string };
}

const rawBase = (c: RepoConfig) =>
  `https://raw.githubusercontent.com/${c.owner}/${c.repo}/${c.branch}`;

/** Fetch text via a direct request, falling back to the CORS proxy. */
async function fetchText(url: string): Promise<string> {
  try {
    const direct = await fetch(url);
    if (direct.ok) return await direct.text();
  } catch {
    // fall through to proxy
  }
  const proxied = await fetch(`/api/fetch?url=${encodeURIComponent(url)}`);
  if (!proxied.ok) {
    throw new Error(`Failed to fetch ${url} (${proxied.status} ${proxied.statusText})`);
  }
  return await proxied.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  return JSON.parse(await fetchText(url)) as T;
}

const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1);

/** Invert index-props into `path -> props[]`, sorted for stable display. */
export function propsByPath(props: PropsIndex): Map<string, string[]> {
  const byPath = new Map<string, string[]>();
  for (const [prop, paths] of Object.entries(props)) {
    for (const path of Object.keys(paths)) {
      const list = byPath.get(path) ?? [];
      list.push(prop);
      byPath.set(path, list);
    }
  }
  for (const list of byPath.values()) list.sort();
  return byPath;
}

/** Merge the three raw index objects into a browsable source list. */
export function mergeRepoIndex(
  sources: SourcesIndex,
  meta: MetaIndex,
  props: PropsIndex
): RepoSource[] {
  const byPath = propsByPath(props);
  const out: RepoSource[] = [];
  for (const [sourceId, path] of Object.entries(sources)) {
    const m = meta[basename(path)];
    out.push({
      sourceId,
      path,
      name: m?.n?.[0] ?? sourceId,
      abbreviations: m?.a ?? [],
      props: byPath.get(path) ?? []
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/** Fetch and merge a repo's index into a browsable source list. */
export async function fetchRepoIndex(config: RepoConfig): Promise<RepoSource[]> {
  const base = `${rawBase(config)}/_generated`;
  const [sources, meta, props] = await Promise.all([
    fetchJson<SourcesIndex>(`${base}/index-sources.json`),
    fetchJson<MetaIndex>(`${base}/index-meta.json`),
    fetchJson<PropsIndex>(`${base}/index-props.json`)
  ]);
  return mergeRepoIndex(sources, meta, props);
}

/** Fetch and parse a single content file from a repo. */
export async function fetchRepoFile(
  config: RepoConfig,
  path: string
): Promise<Record<string, unknown>> {
  // Repo paths contain spaces and other characters; encode each segment.
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return fetchJson<Record<string, unknown>>(`${rawBase(config)}/${encoded}`);
}

/**
 * Content props that map to categories this app understands. A source with none
 * of these (e.g. a monster-only or book-only file) adds nothing playable, so the
 * manager can flag or hide it.
 */
export const SUPPORTED_PROPS = new Set([
  'class',
  'subclass',
  'classFeature',
  'subclassFeature',
  'spell',
  'feat',
  'race',
  'subrace',
  'item',
  'baseitem',
  'magicvariant',
  'background',
  'optionalfeature',
  'action',
  'condition',
  'disease',
  'status'
]);

/** The subset of a source's props this app can actually ingest. */
export function supportedProps(source: RepoSource): string[] {
  return source.props.filter((p) => SUPPORTED_PROPS.has(p));
}
