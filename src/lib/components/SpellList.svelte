<script lang="ts">
  import { character, togglePrepared, removeSpell } from '../stores/character.js';
  import { catalogLookup } from '../stores/catalog.js';

  // Spell level read live from the catalog (cantrip = 0).
  function level(name: string, source: string): string {
    const sp = $catalogLookup.getItem(name, source);
    if (!sp || typeof sp.level !== 'number') return '';
    return sp.level === 0 ? 'cantrip' : `lvl ${sp.level}`;
  }
</script>

<section class="block">
  <h3>Spells</h3>
  {#if $character.spells.length === 0}
    <p class="empty">No spells — add them via quick import.</p>
  {:else}
    <ul>
      {#each $character.spells as spell, i (spell.name + spell.source)}
        <li>
          <label class="prep" title="Prepared">
            <input type="checkbox" checked={spell.prepared} onchange={() => togglePrepared(i)} />
          </label>
          <span class="name">{spell.name}</span>
          <span class="lvl">{level(spell.name, spell.source)}</span>
          <span class="src">{spell.source}</span>
          <button class="rm" aria-label="Remove" onclick={() => removeSpell(i)}>×</button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .block { border: 1px solid var(--line); border-radius: 8px; padding: 0.75rem 1rem; }
  h3 { margin: 0 0 0.6rem; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .empty { color: var(--muted); font-size: 0.85rem; margin: 0; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { display: flex; align-items: center; gap: 0.5rem; padding: 0.22rem 0; border-bottom: 1px solid var(--line); }
  .name { flex: 1; }
  .lvl { font-size: 0.72rem; color: var(--accent); }
  .src { font-size: 0.7rem; text-transform: uppercase; color: var(--muted); }
  .rm { background: none; border: none; color: var(--muted); font-size: 1.1rem; cursor: pointer; line-height: 1; }
  .rm:hover { color: var(--accent); }
</style>
