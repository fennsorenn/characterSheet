<script lang="ts">
  import { character, rest, spendHitDie, adjustHitDie } from '../stores/character.js';
  import { conModifier, hpGainAverage, totalHpGain } from '../character/index.js';
  import PipTracker from './PipTracker.svelte';
  import LevelUpModal from './LevelUpModal.svelte';

  let { variant = 'full' }: { variant?: string } = $props();

  let leveling = $state(false);

  // Average heal for spending one die of this size (+ CON, min 1).
  function healFor(die: number): number {
    return totalHpGain(hpGainAverage(die), conModifier($character));
  }
</script>

<section class="block" data-variant={variant}>
  <header class="head">
    <h3>Rest &amp; Level Up</h3>
    <span class="rests">
      <button onclick={() => rest('short')}>Short rest</button>
      <button class="long" onclick={() => rest('long')}>Long rest</button>
    </span>
  </header>

  <div class="dice">
    <span class="lbl">Hit Dice</span>
    {#each $character.hitDice as pool (pool.die)}
      <div class="pool" data-volatile="frequent">
        <span class="die">d{pool.die}</span>
        <PipTracker
          max={pool.max}
          used={pool.used}
          onSet={(u) => adjustHitDie(pool.die, u - pool.used)}
        />
        <button
          class="spend"
          disabled={pool.used >= pool.max || $character.hp.current >= $character.hp.max}
          title="Spend a die to heal (avg)"
          onclick={() => spendHitDie(pool.die, healFor(pool.die))}
        >
          Spend → +{healFor(pool.die)}
        </button>
      </div>
    {/each}
  </div>

  <button class="levelup" onclick={() => (leveling = true)}>Level Up…</button>
</section>

{#if leveling}
  <LevelUpModal onClose={() => (leveling = false)} />
{/if}

<style>
  .block { border: 1px solid var(--line); border-radius: 8px; padding: 0.75rem 1rem; }
  .head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
  h3 { margin: 0; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .rests { display: flex; gap: 0.4rem; }
  .rests button { font: inherit; font-size: 0.75rem; padding: 0.2rem 0.5rem; border: 1px solid var(--line); background: var(--bg); color: var(--fg); border-radius: 5px; cursor: pointer; }
  .rests .long { border-color: var(--accent); color: var(--accent); }
  .dice { display: flex; flex-direction: column; gap: 0.35rem; }
  .lbl { font-size: 0.7rem; text-transform: uppercase; color: var(--muted); }
  .pool { display: flex; align-items: center; gap: 0.6rem; }
  .die { font-weight: 700; min-width: 2.5rem; }
  .spend {
    font: inherit; font-size: 0.75rem;
    padding: 0.15rem 0.5rem;
    border: 1px solid var(--line);
    background: var(--bg); color: var(--fg);
    border-radius: 5px; cursor: pointer;
  }
  .spend:disabled { opacity: 0.4; cursor: not-allowed; }
  .levelup {
    margin-top: 0.75rem;
    width: 100%;
    padding: 0.45rem;
    border: 1px solid var(--accent);
    background: var(--accent); color: #fff;
    border-radius: 6px; cursor: pointer;
    font: inherit; font-weight: 600;
  }
</style>
