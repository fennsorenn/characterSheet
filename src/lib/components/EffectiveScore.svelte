<script lang="ts">
  import { setAbilityScore } from '../stores/character.js';
  import type { AbilityOverride } from '../stores/character.js';
  import type { Ability } from '../character/index.js';
  import NumberField from './NumberField.svelte';

  // Shows an item-overridden ability score: the effective value takes the place
  // of the raw one (green for a buff, red for a malus), with a badge naming the
  // source. Hover shows the detail (title); click/tap toggles it for touch. The
  // original score stays editable underneath, so no data is lost.
  let { abil, override }: { abil: Ability; override: AbilityOverride } = $props();

  let showDetail = $state(false);
  const detail = $derived(
    `${override.source}: set to ${override.effective} (base ${override.base})`
  );
</script>

<div class="eff" class:buff={override.delta > 0} class:malus={override.delta < 0}>
  <button class="value" title={detail} onclick={() => (showDetail = !showDetail)}>
    {override.effective}
  </button>
  <button class="badge" title={detail} onclick={() => (showDetail = !showDetail)}>
    {override.delta > 0 ? '▲' : '▼'} {override.source}
  </button>
  {#if showDetail}
    <p class="note">{detail}</p>
  {/if}
  <span class="base">
    base <NumberField value={override.base} min={1} max={30} onchange={(v) => setAbilityScore(abil, v)} width="2ch" />
  </span>
</div>

<style>
  .eff { display: flex; flex-direction: column; align-items: center; gap: 0.05rem; --hl: var(--muted); }
  .eff.buff { --hl: #3fa45b; }
  .eff.malus { --hl: #d2645a; }
  .value {
    font: inherit;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--hl);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    line-height: 1.1;
  }
  .badge {
    font: inherit;
    font-size: 0.6rem;
    max-width: 9ch;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #fff;
    background: var(--hl);
    border: none;
    border-radius: 999px;
    padding: 0 0.35rem;
    cursor: pointer;
  }
  .note { font-size: 0.65rem; color: var(--hl); margin: 0.1rem 0; text-align: center; }
  .base { font-size: 0.6rem; color: var(--muted); display: inline-flex; align-items: center; gap: 0.15rem; }
</style>
