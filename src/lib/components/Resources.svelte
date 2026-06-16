<script lang="ts">
  import {
    character,
    featureResourceList,
    setFeatureResourceUsed,
    addResource,
    removeResource,
    adjustResource,
    setResourceMax
  } from '../stores/character.js';
  import type { RestType } from '../character/index.js';
  import NumberField from './NumberField.svelte';
  import PipTracker from './PipTracker.svelte';

  let { variant = 'full' }: { variant?: string } = $props();

  // New-resource form state.
  let name = $state('');
  let max = $state(1);
  let recharge = $state<RestType>('short');

  function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    addResource({ name: trimmed, max, used: 0, recharge });
    name = '';
    max = 1;
  }
</script>

<section class="block" data-variant={variant}>
  <h3>Resources</h3>

  {#if $character.resources.length === 0 && $featureResourceList.length === 0}
    <p class="empty">Track limited-use features — Action Surge, Channel Divinity, Rage, Ki…</p>
  {:else}
    <ul>
      {#each $featureResourceList as r (r.key)}
        <li class="auto">
          <span class="name">{r.name} <span class="owner">{r.owner}</span></span>
          <span data-volatile="frequent">
            <PipTracker max={r.max} used={r.used} onSet={(u) => setFeatureResourceUsed(r.key, u, r.max)} />
          </span>
          <span class="max">{r.max}</span>
          <span class="tag">{r.recharge}</span>
        </li>
      {/each}
      {#each $character.resources as r (r.id)}
        <li>
          <span class="name">{r.name}</span>
          <span data-volatile="frequent">
            <PipTracker max={r.max} used={r.used} onSet={(u) => adjustResource(r.id, u - r.used)} />
          </span>
          <span class="max">max <NumberField value={r.max} min={0} onchange={(v) => setResourceMax(r.id, v)} width="2ch" /></span>
          <span class="tag">{r.recharge}</span>
          <button class="rm" aria-label="Remove" onclick={() => removeResource(r.id)}>×</button>
        </li>
      {/each}
    </ul>
  {/if}

  <form class="add" onsubmit={(e) => { e.preventDefault(); add(); }}>
    <input placeholder="Feature name" bind:value={name} />
    <NumberField value={max} min={1} onchange={(v) => (max = v)} width="2ch" />
    <select bind:value={recharge}>
      <option value="short">short rest</option>
      <option value="long">long rest</option>
    </select>
    <button type="submit">Add</button>
  </form>
</section>

<style>
  .block { border: 1px solid var(--line); border-radius: 8px; padding: 0.75rem 1rem; }
  h3 { margin: 0 0 0.6rem; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .empty { color: var(--muted); font-size: 0.85rem; margin: 0; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { display: flex; align-items: center; gap: 0.6rem; padding: 0.3rem 0; border-bottom: 1px solid var(--line); }
  .name { flex: 1; font-weight: 600; }
  .owner { font-weight: 400; font-size: 0.68rem; color: var(--muted); text-transform: none; }
  li.auto .max { min-width: 1.5ch; text-align: right; }
  .max { font-size: 0.7rem; color: var(--muted); }
  .tag { font-size: 0.65rem; text-transform: uppercase; color: var(--muted); }
  .rm { background: none; border: none; color: var(--muted); font-size: 1.1rem; cursor: pointer; line-height: 1; }
  .rm:hover { color: var(--accent); }
  .add { display: flex; gap: 0.4rem; margin-top: 0.6rem; }
  .add input { flex: 1; }
  .add input, .add select { padding: 0.3rem 0.4rem; border: 1px solid var(--line); border-radius: 5px; background: var(--bg); color: var(--fg); }
  .add button { padding: 0.3rem 0.7rem; border: 1px solid var(--accent); background: var(--accent); color: #fff; border-radius: 5px; cursor: pointer; }
</style>
