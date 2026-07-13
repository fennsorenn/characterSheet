<script lang="ts">
  import { catalogState } from '../stores/catalog.js';
  import { character, setFeatChoice } from '../stores/character.js';
  import { featPicker, closeFeatPicker } from '../stores/featPicker.js';
  import { dedupeBySource, type NamedEntry } from '../data/index.js';
  import { settings } from '../stores/settings.js';

  let query = $state('');

  const target = $derived($featPicker);

  // Feats already taken elsewhere (explicit list + other slots), to avoid dupes.
  const taken = $derived(
    new Set([
      ...$character.feats.map((f) => f.name.toLowerCase()),
      ...Object.entries($character.featChoices)
        .filter(([k]) => k !== target?.key)
        .map(([, ref]) => ref.name.toLowerCase())
    ])
  );

  const matches = $derived.by((): NamedEntry[] => {
    const cat = $catalogState.catalog;
    if (!cat || !target) return [];
    const q = query.trim().toLowerCase();
    return dedupeBySource(cat.entries.feat, $settings.primarySource)
      .filter((f) => !taken.has(f.name.toLowerCase()))
      .filter((f) => !q || f.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  function summary(f: NamedEntry): string {
    const first = (f.entries as unknown[] | undefined)?.find((e) => typeof e === 'string');
    return typeof first === 'string' ? first.replace(/\{@\w+ ([^|}]+)[^}]*\}/g, '$1') : '';
  }

  function pick(f: NamedEntry) {
    if (target) setFeatChoice(target.key, { name: f.name, source: String(f.source) });
    closeFeatPicker();
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && closeFeatPicker()} />

{#if target}
  <div class="backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && closeFeatPicker()}>
    <div class="modal" role="dialog" aria-modal="true" tabindex="-1">
      <header>
        <h2>{target.label}</h2>
        <button class="x" aria-label="Close" onclick={closeFeatPicker}>×</button>
      </header>
      <input class="search" placeholder="Search feats…" bind:value={query} />
      <div class="count">{matches.length} feat{matches.length === 1 ? '' : 's'}</div>
      <ul>
        {#each matches as f (f.name + f.source)}
          <li>
            <button class="row" onclick={() => pick(f)}>
              <span class="nm">{f.name}</span>
              <span class="meta">{f.source}</span>
              <span class="desc">{summary(f)}</span>
            </button>
          </li>
        {:else}
          <li class="empty">No matching feats.</li>
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
  .row { display: grid; grid-template-columns: 1fr auto; gap: 0 0.5rem; width: 100%; text-align: left; background: none; border: none; padding: 0.4rem 0.25rem; cursor: pointer; color: var(--fg); border-bottom: 1px solid var(--line); }
  .row:hover { background: var(--field-hover); }
  .nm { font-weight: 600; }
  .meta { font-size: 0.72rem; color: var(--muted); align-self: baseline; }
  .desc { grid-column: 1 / -1; font-size: 0.74rem; color: var(--muted); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
  .empty { color: var(--muted); padding: 0.5rem 0; }
</style>
