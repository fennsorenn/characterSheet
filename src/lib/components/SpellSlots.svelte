<script lang="ts">
  import {
    character,
    computedSlots,
    setSlotMax,
    setSlotExpended,
    setPactExpended,
    setSpellSlotsAuto
  } from '../stores/character.js';
  import NumberField from './NumberField.svelte';
  import PipTracker from './PipTracker.svelte';

  let { variant = 'full' }: { variant?: string } = $props();

  const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const auto = $derived($character.spellSlotsAuto);
  // Effective max per level: computed from class levels, or the manual entry.
  const maxOf = (l: number) => (auto ? $computedSlots.slots[l - 1] : $character.spellSlots[l - 1].max);
  const active = $derived(LEVELS.filter((l) => maxOf(l) > 0));
  const pact = $derived($computedSlots.pact);
  // Compact grid: levels flow side-by-side instead of one row each.
  const grid = $derived(variant === 'grid');
</script>

<section class="block" data-variant={variant}>
  <header class="head">
    <h3>Spell Slots</h3>
    <label class="auto" title="Compute slots from class levels (multiclass table)">
      <input type="checkbox" checked={auto} onchange={(e) => setSpellSlotsAuto((e.target as HTMLInputElement).checked)} />
      auto
    </label>
  </header>

  {#if !auto}
    <div class="maxrow">
      <span class="cap">Slots per level</span>
      {#each LEVELS as l}
        <label class="maxcell">
          <span>{l}</span>
          <NumberField value={$character.spellSlots[l - 1].max} min={0} max={9} onchange={(v) => setSlotMax(l, v)} width="1.8ch" />
        </label>
      {/each}
    </div>
  {/if}

  {#if active.length === 0 && !pact}
    <p class="empty">{auto ? 'No spell slots at this level.' : 'Set a slot count above to start tracking.'}</p>
  {:else if grid}
    <div class="grid">
      {#each active as l}
        {@const max = maxOf(l)}
        {@const expended = Math.min($character.spellSlots[l - 1].expended, max)}
        <div class="cell">
          <span class="glvl">{l}</span>
          <span data-volatile="frequent" data-print-pips>
            <PipTracker {max} used={expended} onSet={(u) => setSlotExpended(l, u)} />
          </span>
        </div>
      {/each}
      {#if pact}
        {@const used = Math.min($character.pactSlotsExpended, pact.count)}
        <div class="cell pact" title="Pact Magic (level {pact.level})">
          <span class="glvl">P<small>{pact.level}</small></span>
          <span data-volatile="frequent" data-print-pips>
            <PipTracker max={pact.count} {used} onSet={(u) => setPactExpended(u)} />
          </span>
        </div>
      {/if}
    </div>
  {:else}
    <ul>
      {#each active as l}
        {@const max = maxOf(l)}
        {@const expended = Math.min($character.spellSlots[l - 1].expended, max)}
        <li>
          <span class="lvl">Level {l}</span>
          <span data-volatile="frequent" data-print-pips>
            <PipTracker {max} used={expended} onSet={(u) => setSlotExpended(l, u)} />
          </span>
        </li>
      {/each}
      {#if pact}
        {@const used = Math.min($character.pactSlotsExpended, pact.count)}
        <li class="pact">
          <span class="lvl">Pact <small>(lvl {pact.level})</small></span>
          <span data-volatile="frequent" data-print-pips>
            <PipTracker max={pact.count} {used} onSet={(u) => setPactExpended(u)} />
          </span>
        </li>
      {/if}
    </ul>
  {/if}
</section>

<style>
  .block { border: 1px solid var(--line); border-radius: 8px; padding: 0.75rem 1rem; }
  .head { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.6rem; }
  h3 { margin: 0; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .auto { font-size: 0.72rem; color: var(--muted); display: inline-flex; align-items: center; gap: 0.25rem; cursor: pointer; }
  .maxrow { display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap; padding-bottom: 0.5rem; border-bottom: 1px solid var(--line); margin-bottom: 0.5rem; }
  .cap { font-size: 0.7rem; color: var(--muted); margin-right: 0.3rem; }
  .maxcell { display: inline-flex; flex-direction: column; align-items: center; font-size: 0.65rem; color: var(--muted); }
  .empty { color: var(--muted); font-size: 0.85rem; margin: 0; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { display: flex; align-items: center; gap: 0.75rem; padding: 0.3rem 0; }
  li.pact { border-top: 1px solid var(--line); margin-top: 0.2rem; padding-top: 0.45rem; }
  li.pact .lvl { color: var(--accent); }
  .lvl { min-width: 4.5rem; font-weight: 600; }
  .lvl small { font-weight: 400; color: var(--muted); }

  /* Compact grid: each level is a small cell flowing left-to-right and wrapping,
     turning the tall one-row-per-level list into a short, wide strip. */
  .grid { display: flex; flex-wrap: wrap; gap: 0.4rem 0.7rem; }
  .grid .cell {
    display: flex; flex-direction: column; align-items: center; gap: 0.2rem;
    padding: 0.15rem 0.35rem; border: 1px solid var(--line); border-radius: 6px;
  }
  .grid .glvl { font-size: 0.72rem; font-weight: 700; color: var(--muted); line-height: 1; }
  .grid .glvl small { font-weight: 400; }
  .grid .cell.pact { border-color: var(--accent); }
  .grid .cell.pact .glvl { color: var(--accent); }
</style>
