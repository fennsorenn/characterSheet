import type { BlockMeta } from './types.js';

/**
 * Pure metadata for every registered block type — labels, available verbosity
 * variants, and defaults. Kept separate from the Svelte components (registry.ts)
 * so layout operations and the default layout stay framework-agnostic and
 * unit-testable. Keys here must match the component keys in registry.ts.
 */
export const BLOCK_META: Record<string, BlockMeta> = {
  abilityScores: {
    label: 'Ability Scores',
    variants: [
      { key: 'full', label: 'Full (editable boxes)', verbosity: 'full' },
      { key: 'compact', label: 'Compact (row)', verbosity: 'compact' }
    ],
    defaultVariant: 'full',
    defaultSize: 'wide'
  },
  defenses: {
    label: 'Defenses & Core',
    variants: [
      { key: 'full', label: 'Full', verbosity: 'full' },
      { key: 'compact', label: 'Compact (AC/Init/Prof)', verbosity: 'compact' }
    ],
    defaultVariant: 'full',
    defaultSize: 'wide'
  },
  hitPoints: {
    label: 'Hit Points',
    variants: [{ key: 'full', label: 'Full', verbosity: 'full' }],
    defaultVariant: 'full',
    defaultSize: 'narrow'
  },
  restLevelUp: {
    label: 'Rest & Level Up',
    variants: [{ key: 'full', label: 'Full', verbosity: 'full' }],
    defaultVariant: 'full',
    defaultSize: 'narrow'
  },
  spellSlots: {
    label: 'Spell Slots',
    variants: [{ key: 'full', label: 'Full', verbosity: 'full' }],
    defaultVariant: 'full',
    defaultSize: 'wide'
  },
  resources: {
    label: 'Resources',
    variants: [{ key: 'full', label: 'Full', verbosity: 'full' }],
    defaultVariant: 'full',
    defaultSize: 'wide'
  },
  effects: {
    label: 'Effects (Buffs)',
    variants: [{ key: 'full', label: 'Full', verbosity: 'full' }],
    defaultVariant: 'full',
    defaultSize: 'wide'
  },
  conditions: {
    label: 'Conditions',
    variants: [{ key: 'full', label: 'Full', verbosity: 'full' }],
    defaultVariant: 'full',
    defaultSize: 'wide'
  },
  saves: {
    label: 'Saving Throws',
    variants: [{ key: 'full', label: 'Full', verbosity: 'full' }],
    defaultVariant: 'full',
    defaultSize: 'narrow'
  },
  skills: {
    label: 'Skills',
    variants: [
      { key: 'full', label: 'All skills', verbosity: 'full' },
      { key: 'compact', label: 'Proficient only', verbosity: 'compact' }
    ],
    defaultVariant: 'full',
    defaultSize: 'wide'
  },
  inventory: {
    label: 'Inventory',
    variants: [{ key: 'full', label: 'Full', verbosity: 'full' }],
    defaultVariant: 'full',
    defaultSize: 'wide'
  },
  spells: {
    label: 'Spells',
    variants: [{ key: 'full', label: 'Full', verbosity: 'full' }],
    defaultVariant: 'full',
    defaultSize: 'wide'
  }
};

export function blockMeta(type: string): BlockMeta | undefined {
  return BLOCK_META[type];
}

export function allBlockTypes(): string[] {
  return Object.keys(BLOCK_META);
}
