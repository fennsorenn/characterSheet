<script lang="ts">
  import { searchIndex, catalogState } from '../stores/catalog.js';
  import { addInventoryItem, addSpell } from '../stores/character.js';
  import { openBrowse } from '../stores/browse.js';
  import { openVariantPicker } from '../stores/variantPicker.js';
  import { parseTaggedString, renderToText } from '../render/tags.js';
  import { hasVariants, type Category, type SearchHit } from '../data/index.js';

  // Items/spells can be added straight to the character from a hit.
  const ADDABLE: Partial<Record<Category, string>> = { item: 'inventory', spell: 'spellbook' };

  function add(hit: SearchHit) {
    const ref = { name: hit.entry.name, source: hit.entry.source };
    if (hit.category === 'item') addInventoryItem(ref);
    else if (hit.category === 'spell') addSpell(ref);
  }

  // Add the typed text verbatim as a custom (off-catalog / homebrew) entry.
  function addCustom(as: 'item' | 'spell') {
    const name = query.trim();
    if (!name) return;
    if (as === 'item') addInventoryItem({ name, source: 'Custom' });
    else addSpell({ name, source: 'Custom' });
  }

  // Demonstrates context-aware quick import: type to find items/spells/etc.
  let query = $state('');
  let category = $state<Category | 'all'>('all');

  const hits = $derived.by((): SearchHit[] => {
    const index = $searchIndex;
    if (!index || !query) return [];
    return index.search(query, {
      categories: category === 'all' ? undefined : [category],
      limit: 15
    });
  });

  // Strip inline tags from any short descriptive snippet for preview text.
  function snippet(entry: SearchHit['entry']): string {
    const entries = entry.entries;
    const first = Array.isArray(entries) ? entries.find((e) => typeof e === 'string') : null;
    if (typeof first !== 'string') return '';
    const text = renderToText(parseTaggedString(first));
    return text.length > 110 ? text.slice(0, 110) + '…' : text;
  }
</script>

{#if $searchIndex}
  <section class="search">
    <div class="bar">
      <input placeholder="Quick import — search items, spells, feats…" bind:value={query} />
      <select bind:value={category}>
        <option value="all">All</option>
        <option value="item">Items</option>
        <option value="spell">Spells</option>
        <option value="feat">Feats</option>
        <option value="race">Races</option>
        <option value="background">Backgrounds</option>
      </select>
      <button class="browse" onclick={() => openBrowse(category === 'all' ? 'item' : category)}>
        Browse &amp; filter…
      </button>
    </div>

    {#if query}
      <ul class="results">
        {#each hits as hit (hit.category + hit.entry.name + hit.entry.source)}
          <li>
            <span class="cat">{hit.category}</span>
            <span class="name">{hit.entry.name}</span>
            <span class="src">{hit.entry.source}</span>
            {#if ADDABLE[hit.category]}
              <button class="add" title="Add to {ADDABLE[hit.category]}" onclick={() => add(hit)}>
                + Add
              </button>
            {/if}
            {#if hit.category === 'item' && $catalogState.catalog && hasVariants($catalogState.catalog.entries.item, hit.entry.name, String(hit.entry.source))}
              <button
                class="variant"
                title="Add a magic variant of {hit.entry.name}"
                onclick={() => openVariantPicker({ name: hit.entry.name, source: String(hit.entry.source) })}
              >
                Variant…
              </button>
            {/if}
            <span class="desc">{snippet(hit.entry)}</span>
          </li>
        {:else}
          <li class="empty">No matches</li>
        {/each}
        {#if category === 'item' || category === 'spell' || category === 'all'}
          <li class="verbatim">
            <span class="hint">Not in the catalog?</span>
            {#if category === 'item' || category === 'all'}
              <button class="add" onclick={() => addCustom('item')}>+ Add “{query.trim()}” as item</button>
            {/if}
            {#if category === 'spell' || category === 'all'}
              <button class="add" onclick={() => addCustom('spell')}>+ Add “{query.trim()}” as spell</button>
            {/if}
          </li>
        {/if}
      </ul>
    {/if}
  </section>
{/if}

<style>
  .search { margin-top: 1.5rem; }
  .bar { display: flex; gap: 0.5rem; }
  .bar input { flex: 1; }
  input, select {
    padding: 0.45rem 0.55rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--bg);
    color: var(--fg);
  }
  .browse {
    flex: none;
    font: inherit;
    padding: 0.45rem 0.7rem;
    border: 1px solid var(--accent);
    background: var(--bg);
    color: var(--accent);
    border-radius: 6px;
    cursor: pointer;
  }
  .results { list-style: none; padding: 0; margin: 0.5rem 0 0; }
  .results li {
    display: grid;
    grid-template-columns: 6rem 1fr auto auto auto;
    grid-template-areas: 'cat name src variant add' 'cat desc desc desc desc';
    gap: 0.1rem 0.6rem;
    padding: 0.5rem 0.4rem;
    border-bottom: 1px solid var(--line);
    align-items: baseline;
  }
  .add {
    grid-area: add;
    font-size: 0.75rem;
    padding: 0.15rem 0.45rem;
    border: 1px solid var(--accent);
    background: transparent;
    color: var(--accent);
    border-radius: 5px;
    cursor: pointer;
  }
  .add:hover { background: var(--accent); color: #fff; }
  .variant {
    grid-area: variant;
    font-size: 0.75rem;
    padding: 0.15rem 0.45rem;
    border: 1px solid var(--line);
    background: transparent;
    color: var(--muted);
    border-radius: 5px;
    cursor: pointer;
    white-space: nowrap;
  }
  .variant:hover { border-color: var(--accent); color: var(--accent); }
  .cat {
    grid-area: cat;
    font-size: 0.7rem;
    text-transform: uppercase;
    color: var(--accent);
    letter-spacing: 0.03em;
  }
  .name { grid-area: name; font-weight: 600; }
  .src { grid-area: src; color: var(--muted); font-size: 0.8rem; }
  .desc { grid-area: desc; color: var(--muted); font-size: 0.85rem; }
  .empty { color: var(--muted); }
  .results li.verbatim {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    grid-template-columns: none;
    grid-template-areas: none;
  }
  .verbatim .hint { color: var(--muted); font-size: 0.8rem; }
  .verbatim .add { grid-area: auto; }
</style>
