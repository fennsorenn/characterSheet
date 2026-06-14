<script lang="ts">
  import { searchIndex } from '../stores/catalog.js';
  import { parseTaggedString, renderToText } from '../render/tags.js';
  import type { Category, SearchHit } from '../data/index.js';

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
    </div>

    {#if query}
      <ul class="results">
        {#each hits as hit (hit.category + hit.entry.name + hit.entry.source)}
          <li>
            <span class="cat">{hit.category}</span>
            <span class="name">{hit.entry.name}</span>
            <span class="src">{hit.entry.source}</span>
            <span class="desc">{snippet(hit.entry)}</span>
          </li>
        {:else}
          <li class="empty">No matches</li>
        {/each}
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
  .results { list-style: none; padding: 0; margin: 0.5rem 0 0; }
  .results li {
    display: grid;
    grid-template-columns: 6rem 1fr auto;
    grid-template-areas: 'cat name src' 'cat desc desc';
    gap: 0.1rem 0.6rem;
    padding: 0.5rem 0.4rem;
    border-bottom: 1px solid var(--line);
    align-items: baseline;
  }
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
</style>
