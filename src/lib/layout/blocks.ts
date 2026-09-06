import type { BlockInstance, BlockMeta } from './types.js';

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
      { key: 'withSaves', label: 'Full + saving throws', verbosity: 'full' },
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
    defaultSize: 'wide',
    // Every stat is its own switch, so a second instance of this block with only
    // the spell pair on *is* the spellcasting block — no separate type needed.
    options: [
      { key: 'ac', label: 'Armor Class', default: true },
      { key: 'baseAc', label: 'Base AC field', default: true, offIn: ['compact'] },
      { key: 'initiative', label: 'Initiative', default: true },
      { key: 'profBonus', label: 'Proficiency bonus', default: true },
      { key: 'passivePerception', label: 'Passive Perception', default: true, offIn: ['compact'] },
      { key: 'passiveInvestigation', label: 'Passive Investigation', default: false },
      { key: 'passiveInsight', label: 'Passive Insight', default: false },
      { key: 'level', label: 'Level', default: true, offIn: ['compact'] },
      { key: 'spellDc', label: 'Spell save DC', default: true, offIn: ['compact'] },
      { key: 'spellAttack', label: 'Spell attack', default: true, offIn: ['compact'] }
    ]
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
  characterBuild: {
    label: 'Race, Class & Feats',
    variants: [{ key: 'full', label: 'Full', verbosity: 'full' }],
    defaultVariant: 'full',
    defaultSize: 'wide'
  },
  features: {
    label: 'Features & Traits',
    variants: [{ key: 'full', label: 'Full', verbosity: 'full' }],
    defaultVariant: 'full',
    defaultSize: 'wide'
  },
  traits: {
    label: 'Traits & Proficiencies',
    variants: [{ key: 'full', label: 'Full', verbosity: 'full' }],
    defaultVariant: 'full',
    defaultSize: 'wide'
  },
  spellSlots: {
    label: 'Spell Slots',
    variants: [
      { key: 'full', label: 'Full (one level per row)', verbosity: 'full' },
      { key: 'grid', label: 'Compact grid (levels side by side)', verbosity: 'compact' }
    ],
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
  attacks: {
    label: 'Attacks',
    variants: [{ key: 'full', label: 'Full', verbosity: 'full' }],
    defaultVariant: 'full',
    defaultSize: 'wide'
  },
  inventory: {
    label: 'Inventory',
    variants: [{ key: 'full', label: 'Full', verbosity: 'full' }],
    defaultVariant: 'full',
    defaultSize: 'wide',
    // A row, not an arrangement — so an option rather than a second variant.
    // The standalone Currency block is the same row placed on its own, which is
    // why turning this off costs nothing.
    options: [{ key: 'currency', label: 'Currency', default: true }]
  },
  currency: {
    label: 'Currency',
    variants: [
      { key: 'full', label: 'Full', verbosity: 'full' },
      { key: 'compact', label: 'Compact (non-zero only)', verbosity: 'compact' }
    ],
    defaultVariant: 'full',
    defaultSize: 'narrow'
  },
  spells: {
    label: 'Spells',
    variants: [{ key: 'full', label: 'Full', verbosity: 'full' }],
    defaultVariant: 'full',
    defaultSize: 'wide'
  },
  notes: {
    label: 'Notes',
    variants: [{ key: 'full', label: 'Full', verbosity: 'full' }],
    defaultVariant: 'full',
    defaultSize: 'full'
  }
};

export function blockMeta(type: string): BlockMeta | undefined {
  return BLOCK_META[type];
}

export function allBlockTypes(): string[] {
  return Object.keys(BLOCK_META);
}

/** What a block type's options come out as for a variant, before any instance edits. */
export function defaultOptions(type: string, variant?: string): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const o of BLOCK_META[type]?.options ?? []) {
    out[o.key] = variant && o.offIn?.includes(variant) ? false : o.default;
  }
  return out;
}

/**
 * The options a placed block actually renders with: its type's defaults for the
 * variant it is on, overridden by whatever this instance says.
 */
export function resolveOptions(block: BlockInstance): Record<string, boolean> {
  const out = defaultOptions(block.type, block.variant);
  for (const [key, value] of Object.entries(block.options ?? {})) {
    if (key in out) out[key] = value;
  }
  return out;
}
