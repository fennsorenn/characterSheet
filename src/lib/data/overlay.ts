import {
  type Category,
  type ClassData,
  type NamedEntry,
  CATEGORIES
} from './catalog.js';
import { asNamedEntries } from './entries.js';
import { expandVariants } from './variants.js';

/**
 * Overlay content — a single loose 5etools JSON file (a UA/prerelease or
 * homebrew document) parsed into the same shape as the base {@link Catalog},
 * but tagged by a `sourceId` and composed *on top of* the base catalog rather
 * than folded into it (see the catalog store). That keeps prerelease content
 * addable/removable independently and surviving a base-dataset reload.
 *
 * The prop → category mapping here mirrors {@link parseCatalog} exactly; the
 * only difference is the input is one in-memory object, not a zip of files.
 */

export interface Overlay {
  /** Stable source id from the repo index (e.g. "XUA2025Psion"), or a file-derived id. */
  sourceId: string;
  /** Human label for the manager UI (repo meta name, or the sourceId). */
  label: string;
  entries: Record<Category, NamedEntry[]>;
  classData: ClassData;
  counts: Record<Category, number>;
}

/** The raw shape of a 5etools data document — every prop is optional. */
type OverlayDoc = Record<string, unknown>;

/** Read one prop as named entries. */
function prop(doc: OverlayDoc, name: string): NamedEntry[] {
  return asNamedEntries(doc[name]);
}

/**
 * Build overlay categories from a parsed JSON document. Categories that combine
 * several props (race + subrace, the item family, the condition family) follow
 * the same combination the base parser uses.
 */
export function parseOverlayEntries(doc: OverlayDoc): {
  entries: Record<Category, NamedEntry[]>;
  classData: ClassData;
} {
  const entries = {} as Record<Category, NamedEntry[]>;
  for (const c of CATEGORIES) entries[c] = [];

  entries.feat = prop(doc, 'feat');
  entries.background = prop(doc, 'background');
  entries.race = [...prop(doc, 'race'), ...prop(doc, 'subrace')];
  entries.action = prop(doc, 'action');
  entries.optionalfeature = prop(doc, 'optionalfeature');
  entries.condition = [
    ...prop(doc, 'condition'),
    ...prop(doc, 'disease'),
    ...prop(doc, 'status')
  ];
  entries.spell = prop(doc, 'spell');
  entries.class = prop(doc, 'class');
  entries.item = overlayItems(doc);

  // Overlay spells have no entry in the base dataset's generated
  // spell-source-lookup, so they carry no reverse class/subclass index. Spells a
  // UA subclass grants are expressed on the subclass feature's `additionalSpells`
  // instead, which resolves through the character graph, not this index.
  for (const spell of entries.spell) {
    if (spell._classes === undefined) spell._classes = [];
    if (spell._subclasses === undefined) spell._subclasses = [];
  }

  const classData: ClassData = {
    classFeature: prop(doc, 'classFeature'),
    subclassFeature: prop(doc, 'subclassFeature'),
    subclass: prop(doc, 'subclass')
  };

  return { entries, classData };
}

/** Combine premade magic items, base items, and expanded variants from one doc. */
function overlayItems(doc: OverlayDoc): NamedEntry[] {
  const magicItems = prop(doc, 'item');
  const baseItems = prop(doc, 'baseitem');
  const variants = Array.isArray(doc.magicvariant)
    ? (doc.magicvariant as Parameters<typeof expandVariants>[1])
    : [];
  const combined = [...baseItems, ...magicItems, ...expandVariants(baseItems, variants)];

  const seen = new Set<string>();
  const out: NamedEntry[] = [];
  for (const entry of combined) {
    const key = `${entry.name} ${entry.source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

/** Parse a loose document into a fully-formed, counted {@link Overlay}. */
export function parseOverlay(doc: OverlayDoc, sourceId: string, label?: string): Overlay {
  const { entries, classData } = parseOverlayEntries(doc);
  const counts = {} as Record<Category, number>;
  for (const c of CATEGORIES) counts[c] = entries[c].length;
  return { sourceId, label: label ?? sourceId, entries, classData, counts };
}

/** True if the overlay contributed no recognised content (all categories empty). */
export function isEmptyOverlay(overlay: Overlay): boolean {
  return (
    CATEGORIES.every((c) => overlay.entries[c].length === 0) &&
    overlay.classData.classFeature.length === 0 &&
    overlay.classData.subclassFeature.length === 0 &&
    overlay.classData.subclass.length === 0
  );
}
