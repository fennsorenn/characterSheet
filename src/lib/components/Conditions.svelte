<script lang="ts">
  import { CONDITIONS } from '../character/index.js';
  import { character, toggleCondition, setExhaustion } from '../stores/character.js';

  let { variant = 'full' }: { variant?: string } = $props();
  const active = $derived(new Set($character.conditions));
</script>

<section class="block" data-variant={variant}>
  <h3>Conditions</h3>

  <div class="chips">
    {#each CONDITIONS as cond}
      <button class="chip" class:on={active.has(cond)} onclick={() => toggleCondition(cond)}>
        {cond}
      </button>
    {/each}
  </div>

  <div class="exhaust">
    <span class="lbl">Exhaustion</span>
    <div class="steps">
      {#each [1, 2, 3, 4, 5, 6] as n}
        <button
          class="step"
          class:on={$character.exhaustion >= n}
          aria-label="Exhaustion {n}"
          onclick={() => setExhaustion($character.exhaustion === n ? n - 1 : n)}
        >{n}</button>
      {/each}
    </div>
    {#if $character.exhaustion > 0}
      <span class="pen">−{2 * $character.exhaustion} to d20 tests</span>
    {/if}
  </div>
</section>

<style>
  .block { border: 1px solid var(--line); border-radius: 8px; padding: 0.75rem 1rem; }
  h3 { margin: 0 0 0.6rem; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .chips { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .chip {
    font: inherit;
    font-size: 0.78rem;
    padding: 0.2rem 0.5rem;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--bg);
    color: var(--muted);
    cursor: pointer;
  }
  .chip.on { background: var(--accent); border-color: var(--accent); color: #fff; }
  .exhaust { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.75rem; flex-wrap: wrap; }
  .lbl { font-size: 0.7rem; text-transform: uppercase; color: var(--muted); }
  .steps { display: flex; gap: 0.2rem; }
  .step {
    width: 1.6rem; height: 1.6rem;
    border: 1px solid var(--line);
    border-radius: 4px;
    background: var(--bg);
    color: var(--fg);
    cursor: pointer;
  }
  .step.on { background: var(--accent); border-color: var(--accent); color: #fff; }
  .pen { font-size: 0.75rem; color: var(--accent); }
</style>
