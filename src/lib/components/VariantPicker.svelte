<script lang="ts">
  import { catalogState } from '../stores/catalog.js';
  import { addInventoryItem } from '../stores/character.js';
  import { variantPicker, closeVariantPicker } from '../stores/variantPicker.js';
  import { variantsForBase, tokenMatch, type NamedEntry } from '../data/index.js';

  let query = $state('');
  let added = $state<Set<string>>(new Set());

  const target = $derived($variantPicker);

  // Reset the transient state each time a new base item opens the picker.
  $effect(() => {
    target; // track
    query = '';
    added = new Set();
  });

  const variants = $derived.by((): NamedEntry[] => {
    const cat = $catalogState.catalog;
    if (!cat || !target) return [];
    return variantsForBase(cat.entries.item, target.name, target.source)
      .filter((v) => tokenMatch(v.name, query))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  function add(v: NamedEntry) {
    addInventoryItem({ name: v.name, source: String(v.source) });
    added = new Set(added).add(`${v.name}|${v.source}`);
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && closeVariantPicker()} />

{#if target}
  <div class="backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && closeVariantPicker()}>
    <div class="modal" role="dialog" aria-modal="true" tabindex="-1">
      <header>
        <h2>Add variant of {target.name}</h2>
        <button class="x" aria-label="Close" onclick={closeVariantPicker}>×</button>
      </header>
      <input class="search" placeholder="Filter variants…" bind:value={query} />
      <div class="count">{variants.length} variant{variants.length === 1 ? '' : 's'}</div>
      <ul>
        {#each variants as v (v.name + v.source)}
          {@const key = `${v.name}|${v.source}`}
          <li>
            <div class="row">
              <span class="nm">{v.name}</span>
              <span class="meta">{v.source}</span>
              {#if added.has(key)}
                <button class="act added" disabled>Added ✓</button>
              {:else}
                <button class="act" onclick={() => add(v)}>+ Add</button>
              {/if}
            </div>
          </li>
        {:else}
          <li class="empty">No matching variants.</li>
        {/each}
      </ul>
    </div>
  </div>
{/if}

<style>
  .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; padding: 1rem; z-index: 90; }
  .modal { background: var(--bg); border: 1px solid var(--line); border-radius: 10px; width: 100%; max-width: 480px; max-height: 80vh; display: flex; flex-direction: column; padding: 1rem 1.25rem; box-shadow: 0 12px 40px rgba(0,0,0,0.35); }
  header { display: flex; align-items: baseline; justify-content: space-between; }
  h2 { margin: 0; font-size: 1.05rem; color: var(--accent); }
  .x { background: none; border: none; font-size: 1.5rem; color: var(--muted); cursor: pointer; line-height: 1; }
  .search { margin: 0.5rem 0 0.25rem; padding: 0.4rem 0.5rem; border: 1px solid var(--line); border-radius: 6px; background: var(--bg); color: var(--fg); }
  .count { font-size: 0.75rem; color: var(--muted); margin-bottom: 0.25rem; }
  ul { list-style: none; margin: 0; padding: 0; overflow: auto; }
  .row { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 0 0.5rem; padding: 0.4rem 0.25rem; border-bottom: 1px solid var(--line); }
  .nm { font-weight: 600; }
  .meta { font-size: 0.72rem; color: var(--muted); }
  .act { padding: 0.25rem 0.6rem; border: 1px solid var(--accent); background: var(--accent); color: #fff; border-radius: 6px; cursor: pointer; font-size: 0.8rem; }
  .act.added { background: var(--bg); color: var(--fg); border-color: var(--line); cursor: default; }
  .empty { color: var(--muted); padding: 0.5rem 0; }
</style>
