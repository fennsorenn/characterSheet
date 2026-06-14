<script lang="ts">
  // Reusable use tracker: filled pips = available, empty = spent. Clicking a pip
  // sets the level (like a meter), so spending/restoring is one click. Falls back
  // to a numeric ± control for large pools (e.g. Ki points).
  interface Props {
    max: number;
    used: number;
    onSet: (used: number) => void;
  }
  let { max, used, onSet }: Props = $props();
  const PIP_LIMIT = 12;
  const remaining = $derived(max - used);
</script>

{#if max <= 0}
  <span class="none">—</span>
{:else if max <= PIP_LIMIT}
  <span class="pips">
    {#each Array(max) as _, i}
      {@const available = i < remaining}
      <button
        class="pip"
        class:on={available}
        aria-label={`Use ${i + 1} of ${max}`}
        onclick={() => onSet(available ? max - i : max - i - 1)}
      ></button>
    {/each}
  </span>
{:else}
  <span class="numeric">
    <button onclick={() => onSet(Math.min(max, used + 1))} aria-label="Spend one">−</button>
    <span class="count">{remaining}/{max}</span>
    <button onclick={() => onSet(Math.max(0, used - 1))} aria-label="Restore one">+</button>
  </span>
{/if}

<style>
  .pips { display: inline-flex; gap: 0.2rem; flex-wrap: wrap; }
  .pip {
    width: 0.85rem;
    height: 0.85rem;
    border-radius: 50%;
    border: 1.5px solid var(--muted);
    background: transparent;
    cursor: pointer;
    padding: 0;
  }
  .pip.on { background: var(--accent); border-color: var(--accent); }
  .numeric { display: inline-flex; align-items: center; gap: 0.4rem; }
  .numeric button {
    width: 1.3rem;
    height: 1.3rem;
    border: 1px solid var(--line);
    background: var(--bg);
    color: var(--fg);
    border-radius: 4px;
    cursor: pointer;
    line-height: 1;
  }
  .count { font-variant-numeric: tabular-nums; min-width: 3ch; text-align: center; }
  .none { color: var(--muted); }
</style>
