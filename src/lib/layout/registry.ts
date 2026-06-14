import type { Component } from 'svelte';
import AbilityScores from '../components/AbilityScores.svelte';
import Defenses from '../components/Defenses.svelte';
import Saves from '../components/Saves.svelte';
import Skills from '../components/Skills.svelte';
import Inventory from '../components/Inventory.svelte';
import SpellList from '../components/SpellList.svelte';

/**
 * Maps block type keys to their Svelte components. Kept apart from the pure
 * metadata (blocks.ts) so the layout logic never imports UI. Every block
 * component accepts a `variant` prop and renders the matching verbosity.
 */
export type BlockComponent = Component<{ variant?: string }>;

const COMPONENTS: Record<string, BlockComponent> = {
  abilityScores: AbilityScores as BlockComponent,
  defenses: Defenses as BlockComponent,
  saves: Saves as BlockComponent,
  skills: Skills as BlockComponent,
  inventory: Inventory as BlockComponent,
  spells: SpellList as BlockComponent
};

export function componentFor(type: string): BlockComponent | undefined {
  return COMPONENTS[type];
}
