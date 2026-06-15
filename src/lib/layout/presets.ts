import { makeBlock } from './operations.js';
import type { BlockInstance, BlockSize, SheetLayout } from './types.js';

/**
 * Built-in layout presets, each optimised for a different play style. They are
 * ordinary layouts (fully editable once selected); the library seeds them so a
 * new user has solid starting points beyond the default.
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
      ['inventory', 'full', 'wide'],
      ['resources', 'full', 'wide'],
      ['spells', 'full', 'narrow'],
      ['spellSlots', 'full', 'narrow']
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
      ['inventory', 'full', 'wide']
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
      ['inventory', 'full', 'wide'],
      ['skills', 'full', 'wide'],
      ['spells', 'full', 'narrow'],
      ['spellSlots', 'full', 'narrow']
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
      ['spellSlots', 'full', 'narrow']
    ])
  ];
}
