import type { NamedEntry } from './catalog.js';

/**
 * Spell → class/subclass index, built from 5etools'
 * `generated/gendata-spell-source-lookup.json`. That file holds the reverse
 * mapping (class spell lists live in the class data, not on the spells), keyed
 * by spell source then spell name:
 *
 *   { <spellSrc>: { <spellName>: {
 *       class:    { <classSrc>: { <ClassName>: true } },
 *       subclass: { <classSrc>: { <ClassName>: { <scSrc>: { <scKey>: { name } } } } }
 *   } } }
 *
 * We flatten it to the base classes and the subclass display names that grant a
 * spell, so the import browser can filter by either.
 */

export interface SpellClasses {
  classes: string[];
  subclasses: string[];
}

/** Extract base-class and subclass names from one spell's lookup entry. */
export function spellClassesFromLookup(entry: unknown): SpellClasses {
  const classes = new Set<string>();
  const subclasses = new Set<string>();
  const e = entry as {
    class?: Record<string, Record<string, unknown>>;
    subclass?: Record<string, Record<string, Record<string, Record<string, { name?: string }>>>>;
  } | undefined;

  if (e?.class) {
    for (const bySource of Object.values(e.class)) {
      for (const className of Object.keys(bySource)) classes.add(className);
    }
  }
  if (e?.subclass) {
    for (const byClass of Object.values(e.subclass)) {
      for (const byScSource of Object.values(byClass)) {
        for (const byScKey of Object.values(byScSource)) {
          for (const [scKey, sc] of Object.entries(byScKey)) {
            subclasses.add(sc?.name ?? scKey);
          }
        }
      }
    }
  }
  return { classes: [...classes].sort(), subclasses: [...subclasses].sort() };
}

type Lookup = Record<string, Record<string, unknown>>;

/** Annotate spells in place with `_classes` and `_subclasses` from the lookup. */
export function annotateSpellClasses(spells: NamedEntry[], lookup: Lookup | undefined): void {
  for (const spell of spells) {
    const entry = lookup?.[String(spell.source).toLowerCase()]?.[String(spell.name).toLowerCase()];
    const { classes, subclasses } = entry
      ? spellClassesFromLookup(entry)
      : { classes: [], subclasses: [] };
    spell._classes = classes;
    spell._subclasses = subclasses;
  }
}
