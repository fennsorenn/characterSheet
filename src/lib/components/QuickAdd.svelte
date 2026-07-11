<script lang="ts">
  import { searchIndex } from '../stores/catalog.js';
  import { addInventoryItem, addSpell } from '../stores/character.js';
  import type { Category, SearchHit } from '../data/index.js';

  // A compact quick-import bar for the bottom of a specific list (Inventory /
  // Spells). It searches only the relevant catalog category and can also add the
  // typed text verbatim as a custom entry, so homebrew or off-catalog things go
  // straight in without leaving the list.
  let { kind }: { kind: 'item' | 'spell' } = $props();

  const CATEGORY: Record<'item' | 'spell', Category> = { item: 'item', spell: 'spell' };
  const NOUN = { item: 'item', spell: 'spell' } as const;

  let query = $state('');
  let open = $state(false);

  const hits = $derived.by((): SearchHit[] => {
    const index = $searchIndex;
    if (!index || !query.trim()) return [];
    return index.search(query, { categories: [CATEGORY[kind]], limit: 8 });
  });

  function addRef(name: string, source: string) {
    if (kind === 'item') addInventoryItem({ name, source });
    else addSpell({ name, source });
    query = '';
    open = false;
  }

  function addVerbatim() {
    const name = query.trim();
    if (!name) return;
    addRef(name, 'Custom');
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      // Enter takes the top hit, or adds verbatim when there's no match.
      if (hits.length > 0) addRef(hits[0].entry.name, hits[0].entry.source);
      else addVerbatim();
    } else if (e.key === 'Escape') {
      open = false;
    }
  }
</script>

<div class="quickadd">
  <input
    placeholder={`Quick add ${NOUN[kind]}…`}
    bind:value={query}
    onfocus={() => (open = true)}
    onkeydown={onKeydown}
  />
  {#if open && query.trim()}
    <ul class="menu">
      {#each hits as hit (hit.entry.name + hit.entry.source)}
        <li>
          <button class="hit" onclick={() => addRef(hit.entry.name, hit.entry.source)}>
            <span class="name">{hit.entry.name}</span>
            <span class="src">{hit.entry.source}</span>
          </button>
        </li>
      {/each}
      <li>
        <button class="hit verbatim" onclick={addVerbatim}>
          + Add “{query.trim()}” as custom {NOUN[kind]}
        </button>
      </li>
    </ul>
  {/if}
</div>

<style>
  .quickadd { position: relative; margin-top: 0.6rem; }
  .quickadd input {
    width: 100%;
    box-sizing: border-box;
    font: inherit;
    font-size: 0.82rem;
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--bg);
    color: var(--fg);
  }
  .quickadd input:focus { outline: none; border-color: var(--accent); }
  .menu {
    list-style: none;
    margin: 0.25rem 0 0;
    padding: 0.25rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--bg);
    max-height: 15rem;
    overflow: auto;
  }
  .hit {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    width: 100%;
    text-align: left;
    font: inherit;
    font-size: 0.82rem;
    padding: 0.3rem 0.4rem;
    border: none;
    background: none;
    color: var(--fg);
    border-radius: 4px;
    cursor: pointer;
  }
  .hit:hover { background: var(--field-hover); }
  .hit .name { flex: 1; min-width: 0; }
  .hit .src { font-size: 0.68rem; text-transform: uppercase; color: var(--muted); }
  .verbatim { color: var(--accent); }
</style>
