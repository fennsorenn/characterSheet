<script lang="ts">
  import { setAbilityScore } from '../stores/character.js';
  import type { AbilityOverride } from '../stores/character.js';
  import type { Ability } from '../character/index.js';
  import NumberField from './NumberField.svelte';

  // Shows an item-overridden ability score: the effective value takes the place
  // of the raw one (green for a buff, red for a malus), with a small icon hinting
  // at the source (equipment slot / magic). Details are a hover tooltip. The
  // original score stays editable underneath, so no data is lost.
  let { abil, override }: { abil: Ability; override: AbilityOverride } = $props();

  const detail = $derived(
    `${override.source}: set to ${override.effective} (base ${override.base})`
  );
</script>

<div class="eff" class:buff={override.delta > 0} class:malus={override.delta < 0} title={detail}>
  <span class="value">{override.effective}<span class="icon" aria-label={override.source}>{override.icon}</span></span>
  <span class="base">base <NumberField value={override.base} min={1} max={30} onchange={(v) => setAbilityScore(abil, v)} width="3ch" /></span>
</div>

<style>
  .eff { display: flex; flex-direction: column; align-items: center; gap: 0.05rem; --hl: var(--muted); }
  .eff.buff { --hl: #3fa45b; }
  .eff.malus { --hl: #d2645a; }
  .value {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--hl);
    line-height: 1.1;
    display: inline-flex;
    align-items: baseline;
    gap: 0.1rem;
  }
  .icon { font-size: 0.7rem; cursor: help; }
  .base { font-size: 0.6rem; color: var(--muted); display: inline-flex; align-items: center; gap: 0.15rem; }
</style>
