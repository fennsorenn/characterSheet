import { writable } from 'svelte/store';
import { createCharacter, type Character } from '../character/index.js';

/**
 * Local (no-login) character library, kept in localStorage. Each character is
 * stored under `cs.char.<slug>` with a name index at `cs.local.index`, so the
 * overview can list them and the sheet can load one by slug.
 */

const PREFIX = 'cs.char.';
const INDEX = 'cs.local.index';
const LEGACY = 'charactersheet.character';

export interface LocalEntry {
  slug: string;
  name: string;
  updatedAt: number;
}

/** Bumped whenever the local list changes, so the overview refreshes. */
export const localVersion = writable(0);
const bump = () => localVersion.update((n) => n + 1);

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'character'
  );
}

function readIndex(): LocalEntry[] {
  try {
    return JSON.parse(localStorage.getItem(INDEX) ?? '[]');
  } catch {
    return [];
  }
}
function writeIndex(entries: LocalEntry[]) {
  localStorage.setItem(INDEX, JSON.stringify(entries));
  bump();
}

export function localList(): LocalEntry[] {
  if (typeof localStorage === 'undefined') return [];
  return readIndex().sort((a, b) => b.updatedAt - a.updatedAt);
}

/** A slug for `name` not among `taken` (suffixes -2, -3, … on collision). */
export function uniqueSlug(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = slugify(name);
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) if (!used.has(`${base}-${i}`)) return `${base}-${i}`;
}

/**
 * A display name not among `taken` ("Bran" → "Bran (2)").
 *
 * Slugs alone are not enough when a character is copied between libraries: two
 * rows reading "Bran" with different slugs are indistinguishable in a list.
 */
export function uniqueName(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(name)) return name;
  for (let i = 2; ; i++) if (!used.has(`${name} (${i})`)) return `${name} (${i})`;
}

/** A slug for `name` not already used by a local character. */
export function uniqueLocalSlug(name: string): string {
  return uniqueSlug(
    name,
    readIndex().map((e) => e.slug)
  );
}

export function loadLocal(slug: string): Character | null {
  try {
    const raw = localStorage.getItem(PREFIX + slug);
    return raw ? createCharacter(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveLocal(slug: string, name: string, doc: Character) {
  localStorage.setItem(PREFIX + slug, JSON.stringify(doc));
  const index = readIndex().filter((e) => e.slug !== slug);
  index.push({ slug, name, updatedAt: Date.now() });
  writeIndex(index);
}

export function deleteLocal(slug: string) {
  localStorage.removeItem(PREFIX + slug);
  writeIndex(readIndex().filter((e) => e.slug !== slug));
}

/** Migrate a pre-multi-user single character into the local library, once. */
export function migrateLegacyCharacter() {
  if (typeof localStorage === 'undefined') return;
  const raw = localStorage.getItem(LEGACY);
  if (!raw || readIndex().length > 0) return;
  try {
    const doc = createCharacter(JSON.parse(raw));
    saveLocal(uniqueLocalSlug(doc.name), doc.name, doc);
    localStorage.removeItem(LEGACY);
  } catch {
    /* ignore corrupt legacy data */
  }
}
