import { makeBlock } from './operations.js';
import type { BlockInstance, BlockSize, SheetLayout } from './types.js';

/**
 * Starting points for new templates, each optimised for a different play style.
 *
 * These are *not* fixed entries in the library — nothing pins them there and
 * nothing refreshes them. They exist purely so "New template" can seed a fresh,
 * fully-owned template with a sensible arrangement instead of a blank page.
 */

type Spec = [type: string, variant?: string, size?: BlockSize];

function buildLayout(id: string, name: string, specs: Spec[]): SheetLayout {
  const blocks = specs
    .map(([type, variant, size]) => {
      const block = makeBlock(type);
      if (!block) return null;
      if (variant) block.variant = variant;
      if (size) block.size = size;
      return block;
    })
    .filter((b): b is BlockInstance => b !== null);
  return { id, name, blocks };
}

/**
 * Default arrangement for the dedicated print layout. On paper the grid is two
 * columns (narrow = half, wide/full = full), so sizes are chosen for a dense,
 * legible single-or-few-page sheet.
 */
export function printDefaultLayout(): SheetLayout {
  return buildLayout('print', 'Print', [
    ['abilityScores', 'full', 'full'],
    ['defenses', 'full', 'full'],
    ['hitPoints', 'full', 'narrow'],
    ['restLevelUp', 'full', 'narrow'],
    ['saves', 'full', 'narrow'],
    ['skills', 'full', 'narrow'],
    ['conditions', 'full', 'narrow'],
    ['resources', 'full', 'narrow'],
    ['effects', 'full', 'narrow'],
    ['attacks', 'full', 'full'],
    ['inventory', 'full', 'full'],
    ['spells', 'full', 'narrow'],
    ['spellSlots', 'full', 'narrow']
  ]);
}

export function builtinPresets(): SheetLayout[] {
  return [
    // General-purpose. Abilities + skills as the tall left spine, combat state
    // and trackers tiling the rest; sizes chosen so rows fill the 12-col grid.
    buildLayout('default', 'Default', [
      ['abilityScores', 'full', 'narrow'],
      ['defenses', 'full', 'wide'],
      ['hitPoints', 'full', 'narrow'],
      ['restLevelUp', 'full', 'narrow'],
      ['conditions', 'full', 'wide'],
      ['effects', 'full', 'narrow'],
      ['saves', 'full', 'narrow'],
      ['skills', 'full', 'wide'],
      ['attacks', 'full', 'wide'],
      ['features', 'full', 'wide'],
      ['traits', 'full', 'wide'],
      ['inventory', 'full', 'wide'],
      ['resources', 'full', 'wide'],
      ['spells', 'full', 'narrow'],
      ['spellSlots', 'full', 'narrow'],
      ['notes', 'full', 'full']
    ]),
    // Caster: spell slots and spell list up top and prominent.
    buildLayout('caster', 'Caster', [
      ['abilityScores', 'compact', 'full'],
      ['defenses', 'compact', 'narrow'],
      ['hitPoints', 'full', 'narrow'],
      ['effects', 'full', 'narrow'],
      ['conditions', 'full', 'narrow'],
      ['spellSlots', 'full', 'wide'],
      ['spells', 'full', 'wide'],
      ['saves', 'full', 'narrow'],
      ['skills', 'full', 'narrow'],
      ['resources', 'full', 'wide'],
      ['inventory', 'full', 'wide'],
      ['notes', 'full', 'full']
    ]),
    // Martial: HP, resources, and gear front and centre.
    buildLayout('martial', 'Martial', [
      ['abilityScores', 'full', 'wide'],
      ['defenses', 'full', 'wide'],
      ['hitPoints', 'full', 'narrow'],
      ['restLevelUp', 'full', 'narrow'],
      ['resources', 'full', 'narrow'],
      ['conditions', 'full', 'wide'],
      ['effects', 'full', 'narrow'],
      ['saves', 'full', 'narrow'],
      ['attacks', 'full', 'wide'],
      ['inventory', 'full', 'wide'],
      ['skills', 'full', 'wide'],
      ['traits', 'full', 'wide'],
      ['spells', 'full', 'narrow'],
      ['spellSlots', 'full', 'narrow'],
      ['notes', 'full', 'full']
    ]),
    // Compact: everything narrow and terse, packs densely on any width.
    buildLayout('compact', 'Compact', [
      ['abilityScores', 'compact', 'full'],
      ['defenses', 'compact', 'narrow'],
      ['hitPoints', 'full', 'narrow'],
      ['saves', 'full', 'narrow'],
      ['effects', 'full', 'narrow'],
      ['conditions', 'full', 'narrow'],
      ['skills', 'compact', 'narrow'],
      ['resources', 'full', 'narrow'],
      ['inventory', 'full', 'narrow'],
      ['spells', 'full', 'narrow'],
      ['spellSlots', 'full', 'narrow'],
      ['notes', 'full', 'full']
    ])
  ];
}

/** A starting point offered by the "New template" form. */
export interface Starter {
  key: string;
  name: string;
  description: string;
}

/**
 * The starting points a new template can be seeded from. `blank` and `current`
 * are handled by the caller (which knows the active template); the rest map to
 * the preset arrangements above.
 */
export const STARTERS: Starter[] = [
  { key: 'blank', name: 'Blank', description: 'No blocks — build it up yourself.' },
  { key: 'current', name: 'Copy of current', description: "The active template's blocks." },
  { key: 'default', name: 'Default', description: 'General-purpose arrangement.' },
  { key: 'caster', name: 'Caster', description: 'Slots and spell list up top.' },
  { key: 'martial', name: 'Martial', description: 'HP, resources, and gear front and centre.' },
  { key: 'compact', name: 'Compact', description: 'Everything narrow and terse.' }
];

/**
 * Blocks for a preset starting point (empty for `blank`/unknown). `current` is
 * not resolved here — the caller supplies the active template's blocks.
 */
export function starterBlocks(key: string): BlockInstance[] {
  return builtinPresets().find((p) => p.id === key)?.blocks ?? [];
}
