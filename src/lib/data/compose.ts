import { type Catalog, type Category, CATEGORIES } from './catalog.js';
import type { Overlay } from './overlay.js';

/**
 * Compose the base {@link Catalog} with any active {@link Overlay}s into the
 * single catalog the rest of the app consumes. Overlays are layered *after* the
 * base so their entries are additive; a UA subclass sits alongside the PHB ones.
 *
 * The result is an ordinary Catalog — search index, item/feat/spell lookups, and
 * the character calc graph all keep consuming it unchanged. Composition is a pure
 * function of (base, overlays), so it re-runs whenever either changes.
 */

/** Compose the base catalog with overlays. Returns the base as-is if none. */
export function composeCatalog(base: Catalog, overlays: Overlay[]): Catalog {
  if (overlays.length === 0) return base;

  const entries = {} as Record<Category, typeof base.entries[Category]>;
  const counts = {} as Record<Category, number>;
  for (const c of CATEGORIES) {
    entries[c] = [...base.entries[c]];
    for (const o of overlays) entries[c].push(...o.entries[c]);
    counts[c] = entries[c].length;
  }

  const classData = {
    classFeature: [...base.classData.classFeature],
    subclassFeature: [...base.classData.subclassFeature],
    subclass: [...base.classData.subclass]
  };
  for (const o of overlays) {
    classData.classFeature.push(...o.classData.classFeature);
    classData.subclassFeature.push(...o.classData.subclassFeature);
    classData.subclass.push(...o.classData.subclass);
  }

  const suffix = overlays.map((o) => o.sourceId).join('+');
  return { version: `${base.version} +${suffix}`, entries, counts, classData };
}
