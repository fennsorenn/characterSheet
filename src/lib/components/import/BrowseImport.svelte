<script lang="ts">
  import { get } from 'svelte/store';
  import { catalogState } from '../../stores/catalog.js';
  import { browseCategory, closeBrowse } from '../../stores/browse.js';
  import { addInventoryItem, addSpell, addFeat, setRace, setBackground } from '../../stores/character.js';
  import {
    CATEGORIES,
    facetsFor,
    filterEntries,
    facetOptions,
    itemTypeLabel,
    type Category,
    type NamedEntry,
    type Selection
  } from '../../data/index.js';
  import { iconForItem, iconForSchool, spellTags } from '../../character/index.js';
  import Icon from '../Icon.svelte';

  const RESULT_LIMIT = 250;
  const ADDABLE = new Set<Category>(['item', 'spell', 'feat', 'race', 'background']);
  const ADD_VERB: Partial<Record<Category, string>> = { race: '✓ Set', background: '✓ Set' };

  let category = $state<Category>(get(browseCategory));
  let name = $state('');
  let selected = $state<Selection>({});
  let added = $state<Set<string>>(new Set());

  const catalog = $derived($catalogState.catalog);
  const categories = $derived(
    CATEGORIES.filter((c) => (catalog?.counts[c] ?? 0) > 0)
  );
  const entries = $derived<NamedEntry[]>(catalog ? catalog.entries[category] : []);
  const facets = $derived(facetsFor(category));
  const filtered = $derived(filterEntries(entries, name, facets, selected));
  const options = $derived(facetOptions(entries, name, facets, selected));
  const results = $derived(filtered.slice(0, RESULT_LIMIT));

  function changeCategory(c: Category) {
    category = c;
    selected = {};
    name = '';
  }

  function toggle(facetKey: string, value: string) {
    const next: Selection = {};
    for (const [k, v] of Object.entries(selected)) next[k] = new Set(v);
    const set = next[facetKey] ?? new Set<string>();
    set.has(value) ? set.delete(value) : set.add(value);
    next[facetKey] = set;
    selected = next;
  }

  const activeCount = $derived(
    Object.values(selected).reduce((n, s) => n + s.size, 0)
  );
  function clearAll() {
    selected = {};
    name = '';
  }

  const key = (e: NamedEntry) => `${category}:${e.name}:${e.source}`;
  function add(e: NamedEntry) {
    const ref = { name: e.name, source: e.source };
    if (category === 'item') addInventoryItem(ref);
    else if (category === 'spell') addSpell(ref);
    else if (category === 'feat') addFeat(ref);
    else if (category === 'race') setRace(ref);
    else if (category === 'background') setBackground(ref);
    added = new Set(added).add(key(e));
  }

  // Per-category row helpers.
  const levelLabel = (e: NamedEntry) =>
    typeof e.level === 'number' ? (e.level === 0 ? 'Cantrip' : `Level ${e.level}`) : '';
</script>

<div class="overlay">
  <header class="bar">
    <strong>Browse &amp; Import</strong>
    <div class="cats">
      {#each categories as c}
        <button class="cat" class:on={c === category} onclick={() => changeCategory(c)}>
          {c}<span class="n">{catalog?.counts[c]}</span>
        </button>
      {/each}
    </div>
    <button class="close" onclick={closeBrowse}>Close ✕</button>
  </header>

  <div class="body">
    <aside class="filters">
      <input class="search" placeholder="Search name…" bind:value={name} />
      {#if activeCount > 0}
        <button class="clear" onclick={clearAll}>Clear filters ({activeCount})</button>
      {/if}
      {#each facets as facet (facet.key)}
        {#if options[facet.key]?.length}
          <div class="facet">
            <div class="flabel">{facet.label}</div>
            <div class="chips">
              {#each options[facet.key] as opt (opt.value)}
                <button
                  class="chip"
                  class:on={selected[facet.key]?.has(opt.value)}
                  onclick={() => toggle(facet.key, opt.value)}
                >
                  {opt.label}<span class="c">{opt.count}</span>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      {/each}
    </aside>

    <main class="results">
      <div class="count">
        {filtered.length} result{filtered.length === 1 ? '' : 's'}
        {#if filtered.length > RESULT_LIMIT}<span class="muted"> · showing first {RESULT_LIMIT}</span>{/if}
      </div>
      <ul>
        {#each results as e, i (e.name + '|' + e.source + '|' + i)}
          <li>
            {#if category === 'item'}
              <span class="ic" title={itemTypeLabel(e)}><Icon name={iconForItem(e)} /></span>
            {:else if category === 'spell'}
              <span class="ic"><Icon name={iconForSchool(e.school)} /></span>
            {/if}
            <div class="info">
              <span class="nm">{e.name}</span>
              <span class="meta">
                {#if category === 'item'}
                  {itemTypeLabel(e)}{e.rarity && e.rarity !== 'none' ? ` · ${e.rarity}` : ''}{e.reqAttune ? ' · attune' : ''} · {e.source}
                {:else if category === 'spell'}
                  {levelLabel(e)} · {e.source}
                {:else}
                  {e.source}
                {/if}
              </span>
              {#if category === 'spell'}
                <span class="tags">
                  {#each spellTags(e).filter((t) => !t.id.startsWith('school:')) as t (t.id)}
                    <span class="tag" title={t.label}><Icon name={t.icon} /></span>
                  {/each}
                </span>
              {/if}
            </div>
            {#if ADDABLE.has(category)}
              <button class="add" class:done={added.has(key(e))} onclick={() => add(e)}>
                {added.has(key(e)) ? (ADD_VERB[category] ?? '✓ Added') : '+ Add'}
              </button>
            {/if}
          </li>
        {:else}
          <li class="empty">No results match these filters.</li>
        {/each}
      </ul>
    </main>
  </div>
</div>

<style>
  .overlay { position: fixed; inset: 0; z-index: 80; background: var(--bg); display: flex; flex-direction: column; }
  .bar { display: flex; align-items: center; gap: 1rem; padding: 0.6rem 1rem; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
  .cats { display: flex; gap: 0.3rem; flex: 1; flex-wrap: wrap; }
  .cat { font: inherit; font-size: 0.8rem; text-transform: capitalize; padding: 0.25rem 0.55rem; border: 1px solid var(--line); background: var(--bg); color: var(--fg); border-radius: 6px; cursor: pointer; }
  .cat.on { background: var(--accent); border-color: var(--accent); color: #fff; }
  .cat .n { margin-left: 0.35rem; opacity: 0.7; font-size: 0.7rem; }
  .close { font: inherit; padding: 0.3rem 0.7rem; border: 1px solid var(--line); background: var(--bg); color: var(--fg); border-radius: 6px; cursor: pointer; }

  .body { flex: 1; display: flex; min-height: 0; }
  .filters { width: 16rem; flex: none; overflow: auto; padding: 0.75rem; border-right: 1px solid var(--line); }
  .search { width: 100%; padding: 0.4rem 0.5rem; border: 1px solid var(--line); border-radius: 6px; background: var(--bg); color: var(--fg); }
  .clear { display: block; margin: 0.5rem 0; font: inherit; font-size: 0.75rem; color: var(--accent); background: none; border: none; cursor: pointer; }
  .facet { margin-top: 0.75rem; }
  .flabel { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin-bottom: 0.3rem; }
  .chips { display: flex; flex-wrap: wrap; gap: 0.25rem; }
  .chip { font: inherit; font-size: 0.72rem; padding: 0.12rem 0.4rem; border: 1px solid var(--line); background: var(--bg); color: var(--fg); border-radius: 999px; cursor: pointer; }
  .chip.on { background: var(--accent); border-color: var(--accent); color: #fff; }
  .chip .c { margin-left: 0.3rem; opacity: 0.6; font-size: 0.65rem; }

  .results { flex: 1; overflow: auto; padding: 0.5rem 1rem 2rem; }
  .count { font-size: 0.8rem; color: var(--muted); padding: 0.25rem 0; position: sticky; top: 0; background: var(--bg); }
  .muted { color: var(--muted); }
  ul { list-style: none; margin: 0; padding: 0; }
  li { display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0.2rem; border-bottom: 1px solid var(--line); }
  .ic { color: var(--muted); flex: none; display: inline-flex; }
  .ic :global(.icon) { width: 1.2rem; height: 1.2rem; }
  .info { flex: 1; min-width: 0; }
  .nm { font-weight: 600; }
  .meta { display: block; font-size: 0.75rem; color: var(--muted); text-transform: capitalize; }
  .tags { display: inline-flex; flex-wrap: wrap; gap: 0.15rem; margin-top: 0.1rem; color: var(--muted); }
  .tag :global(.icon) { width: 0.8rem; height: 0.8rem; }
  .add { flex: none; font: inherit; font-size: 0.78rem; padding: 0.25rem 0.6rem; border: 1px solid var(--accent); background: transparent; color: var(--accent); border-radius: 6px; cursor: pointer; }
  .add:hover { background: var(--accent); color: #fff; }
  .add.done { border-color: var(--muted); color: var(--muted); background: transparent; }
  .empty { color: var(--muted); }
  @media (max-width: 680px) {
    .filters { width: 12rem; }
  }
</style>
