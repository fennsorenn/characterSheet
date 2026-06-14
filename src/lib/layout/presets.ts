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

export function builtinPresets(): SheetLayout[] {
  return [
    buildLayout('default', 'Default', [
      ['abilityScores'],
      ['defenses'],
      ['hitPoints'],
      ['conditions'],
      ['effects'],
      ['saves'],
      ['skills'],
      ['inventory'],
      ['resources'],
      ['spells'],
      ['spellSlots']
    ]),
    buildLayout('caster', 'Caster', [
      ['abilityScores', 'compact', 'full'],
      ['defenses', 'compact', 'wide'],
      ['hitPoints', 'full', 'narrow'],
      ['spellSlots'],
      ['spells'],
      ['effects'],
      ['conditions'],
      ['saves'],
      ['skills'],
      ['resources'],
      ['inventory']
    ]),
    buildLayout('martial', 'Martial', [
      ['abilityScores'],
      ['defenses'],
      ['hitPoints'],
      ['resources'],
      ['conditions'],
      ['effects'],
      ['inventory'],
      ['saves'],
      ['skills'],
      ['spells'],
      ['spellSlots']
    ]),
    buildLayout('compact', 'Compact', [
      ['abilityScores', 'compact', 'full'],
      ['defenses', 'compact', 'narrow'],
      ['hitPoints', 'full', 'narrow'],
      ['conditions', 'full', 'wide'],
      ['effects', 'full', 'narrow'],
      ['saves', 'full', 'narrow'],
      ['skills', 'compact', 'narrow'],
      ['resources', 'full', 'wide'],
      ['inventory', 'full', 'wide'],
      ['spells', 'full', 'narrow'],
      ['spellSlots', 'full', 'wide']
    ])
  ];
}
