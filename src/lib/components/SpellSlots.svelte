<script lang="ts">
  import { character, setSlotMax, adjustSlot } from '../stores/character.js';
  import NumberField from './NumberField.svelte';
  import PipTracker from './PipTracker.svelte';

  let { variant = 'full' }: { variant?: string } = $props();

  const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const active = $derived(LEVELS.filter((l) => $character.spellSlots[l - 1].max > 0));
</script>

<section class="block" data-variant={variant}>
  <h3>Spell Slots</h3>

  <div class="maxrow">
    <span class="cap">Slots per level</span>
    {#each LEVELS as l}
      <label class="maxcell">
        <span>{l}</span>
        <NumberField value={$character.spellSlots[l - 1].max} min={0} max={9} onchange={(v) => setSlotMax(l, v)} width="1.8ch" />
      </label>
    {/each}
  </div>

  {#if active.length === 0}
    <p class="empty">Set a slot count above to start tracking.</p>
  {:else}
    <ul>
      {#each active as l}
        {@const slot = $character.spellSlots[l - 1]}
        <li>
          <span class="lvl">Level {l}</span>
          <span data-volatile="frequent">
            <PipTracker max={slot.max} used={slot.expended} onSet={(u) => adjustSlot(l, u - slot.expended)} />
          </span>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .block { border: 1px solid var(--line); border-radius: 8px; padding: 0.75rem 1rem; }
  h3 { margin: 0 0 0.6rem; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .maxrow { display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap; padding-bottom: 0.5rem; border-bottom: 1px solid var(--line); margin-bottom: 0.5rem; }
  .cap { font-size: 0.7rem; color: var(--muted); margin-right: 0.3rem; }
  .maxcell { display: inline-flex; flex-direction: column; align-items: center; font-size: 0.65rem; color: var(--muted); }
  .empty { color: var(--muted); font-size: 0.85rem; margin: 0; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { display: flex; align-items: center; gap: 0.75rem; padding: 0.3rem 0; }
  .lvl { min-width: 4.5rem; font-weight: 600; }
</style>
