<script lang="ts">
  import { setAbilityScore } from '../stores/character.js';
  import type { AbilityOverride } from '../stores/character.js';
  import type { Ability } from '../character/index.js';
  import NumberField from './NumberField.svelte';
  import Icon from './Icon.svelte';

  // Shows an item-overridden ability score: the effective value takes the place
  // of the raw one (green for a buff, red for a malus), with a small icon hinting
  // at the source (equipment slot / magic). Details are a hover tooltip. The
  // original score stays editable underneath, so no data is lost.
  let { abil, override }: { abil: Ability; override: AbilityOverride } = $props();

  const detail = $derived(
    `${override.source} → ${override.effective} (base ${override.base})`
  );
</script>

<div class="eff" class:buff={override.delta > 0} class:malus={override.delta < 0} title={detail}>
  <span class="value">
    {override.effective}
    <span class="badge" aria-label={override.source}><Icon name={override.icon} /></span>
  </span>
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
    align-items: center;
    gap: 0.15rem;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 0.95rem;
    height: 0.95rem;
    border-radius: 4px;
    background: color-mix(in srgb, var(--hl) 18%, transparent);
    color: var(--hl);
    cursor: help;
  }
  .badge :global(.icon) { width: 0.7rem; height: 0.7rem; }
  .base { font-size: 0.6rem; color: var(--muted); display: inline-flex; align-items: center; gap: 0.15rem; }
</style>
