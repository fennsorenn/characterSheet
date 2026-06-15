<script lang="ts">
  import { catalogState } from '../stores/catalog.js';
  import { setSpellChoice } from '../stores/character.js';
  import { spellPicker, closeSpellPicker } from '../stores/spellPicker.js';
  import { spellMatchesChoice, iconForSchool } from '../character/index.js';
  import type { NamedEntry } from '../data/index.js';
  import Icon from './Icon.svelte';

  let query = $state('');

  const target = $derived($spellPicker);
  const matches = $derived.by((): NamedEntry[] => {
    const cat = $catalogState.catalog;
    if (!cat || !target) return [];
    const q = query.trim().toLowerCase();
    return cat.entries.spell
      .filter((s) => spellMatchesChoice(s, target.filter))
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 200);
  });

  function pick(s: NamedEntry) {
    if (target) setSpellChoice(target.key, { name: s.name, source: String(s.source) });
    closeSpellPicker();
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && closeSpellPicker()} />

{#if target}
  <div class="backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && closeSpellPicker()}>
    <div class="modal" role="dialog" aria-modal="true" tabindex="-1">
      <header>
        <h2>{target.label}</h2>
        <button class="x" aria-label="Close" onclick={closeSpellPicker}>×</button>
      </header>
      <input class="search" placeholder="Search…" bind:value={query} />
      <div class="count">{matches.length} match{matches.length === 1 ? '' : 'es'}</div>
      <ul>
        {#each matches as s (s.name + s.source)}
          <li>
            <button class="row" onclick={() => pick(s)}>
              <span class="ic"><Icon name={iconForSchool(s.school)} /></span>
              <span class="nm">{s.name}</span>
              <span class="meta">{typeof s.level === 'number' ? (s.level === 0 ? 'cantrip' : `lvl ${s.level}`) : ''} · {s.source}</span>
            </button>
          </li>
        {:else}
          <li class="empty">No matching spells.</li>
        {/each}
      </ul>
    </div>
  </div>
{/if}

<style>
  .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; padding: 1rem; z-index: 90; }
  .modal { background: var(--bg); border: 1px solid var(--line); border-radius: 10px; width: 100%; max-width: 460px; max-height: 80vh; display: flex; flex-direction: column; padding: 1rem 1.25rem; box-shadow: 0 12px 40px rgba(0,0,0,0.35); }
  header { display: flex; align-items: baseline; justify-content: space-between; }
  h2 { margin: 0; font-size: 1.05rem; color: var(--accent); }
  .x { background: none; border: none; font-size: 1.5rem; color: var(--muted); cursor: pointer; line-height: 1; }
  .search { margin: 0.5rem 0 0.25rem; padding: 0.4rem 0.5rem; border: 1px solid var(--line); border-radius: 6px; background: var(--bg); color: var(--fg); }
  .count { font-size: 0.75rem; color: var(--muted); margin-bottom: 0.25rem; }
  ul { list-style: none; margin: 0; padding: 0; overflow: auto; }
  .row { display: flex; align-items: center; gap: 0.5rem; width: 100%; text-align: left; background: none; border: none; padding: 0.35rem 0.25rem; cursor: pointer; color: var(--fg); border-bottom: 1px solid var(--line); }
  .row:hover { background: var(--field-hover); }
  .ic { color: var(--muted); display: inline-flex; }
  .ic :global(.icon) { width: 1rem; height: 1rem; }
  .nm { flex: 1; font-weight: 500; }
  .meta { font-size: 0.72rem; color: var(--muted); }
  .empty { color: var(--muted); padding: 0.5rem 0; }
</style>
