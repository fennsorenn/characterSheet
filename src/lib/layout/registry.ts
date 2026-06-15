import type { Component } from 'svelte';
import AbilityScores from '../components/AbilityScores.svelte';
import Defenses from '../components/Defenses.svelte';
import Saves from '../components/Saves.svelte';
import Skills from '../components/Skills.svelte';
import Inventory from '../components/Inventory.svelte';
import SpellList from '../components/SpellList.svelte';
import HitPoints from '../components/HitPoints.svelte';
import SpellSlots from '../components/SpellSlots.svelte';
import Resources from '../components/Resources.svelte';
import Effects from '../components/Effects.svelte';
import Conditions from '../components/Conditions.svelte';
import RestLevelUp from '../components/RestLevelUp.svelte';
import Attacks from '../components/Attacks.svelte';
import Features from '../components/Features.svelte';

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
  spells: SpellList as BlockComponent,
  hitPoints: HitPoints as BlockComponent,
  spellSlots: SpellSlots as BlockComponent,
  resources: Resources as BlockComponent,
  effects: Effects as BlockComponent,
  conditions: Conditions as BlockComponent,
  restLevelUp: RestLevelUp as BlockComponent,
  attacks: Attacks as BlockComponent,
  features: Features as BlockComponent
};

export function componentFor(type: string): BlockComponent | undefined {
  return COMPONENTS[type];
}
