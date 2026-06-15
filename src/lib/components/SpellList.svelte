<script lang="ts">
  import { character, togglePrepared, removeSpell } from '../stores/character.js';
  import { catalogLookup } from '../stores/catalog.js';
  import { spellTags, type SpellTag } from '../character/index.js';
  import Icon from './Icon.svelte';

  let { variant = 'full' }: { variant?: string } = $props();

  // Filter state: a spell is shown only if it has every selected tag (AND).
  let selected = $state<Set<string>>(new Set());

  interface Tagged {
    index: number;
    name: string;
    source: string;
    prepared: boolean;
    level: string;
    tags: SpellTag[];
  }

  const tagged = $derived.by((): Tagged[] =>
    $character.spells.map((s, index) => {
      const entry = $catalogLookup.getSpell(s.name, s.source);
      const level =
        entry && typeof entry.level === 'number'
          ? entry.level === 0
            ? 'cantrip'
            : `lvl ${entry.level}`
          : '';
      return {
        index,
        name: s.name,
        source: s.source,
        prepared: !!s.prepared,
        level,
        tags: entry ? spellTags(entry) : []
      };
    })
  );

  // Unique tags across all spells, for the filter bar (stable group order).
  const groupRank = (id: string) =>
    id.startsWith('school:') ? 0 : id.startsWith('damage:') ? 1 : id.startsWith('cond:') ? 2 : 3;
  const allTags = $derived.by((): SpellTag[] => {
    const map = new Map<string, SpellTag>();
    for (const t of tagged) for (const tag of t.tags) if (!map.has(tag.id)) map.set(tag.id, tag);
    return [...map.values()].sort((a, b) => groupRank(a.id) - groupRank(b.id) || a.id.localeCompare(b.id));
  });

  const shown = $derived(
    selected.size === 0
      ? tagged
      : tagged.filter((t) => {
          const ids = new Set(t.tags.map((x) => x.id));
          return [...selected].every((id) => ids.has(id));
        })
  );

  function toggle(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    selected = next;
  }
</script>

<section class="block" data-variant={variant}>
  <h3>Spells</h3>
  {#if $character.spells.length === 0}
    <p class="empty">No spells — add them via quick import.</p>
  {:else}
    {#if allTags.length > 0}
      <div class="filterbar">
        {#each allTags as tag (tag.id)}
          <button
            class="ftag"
            class:on={selected.has(tag.id)}
            title={tag.label}
            onclick={() => toggle(tag.id)}
          ><Icon name={tag.icon} /></button>
        {/each}
        {#if selected.size > 0}
          <button class="clear" onclick={() => (selected = new Set())}>clear</button>
        {/if}
      </div>
    {/if}

    <ul>
      {#each shown as s (s.name + s.source)}
        <li>
          <div class="top">
            <label class="prep" title="Prepared">
              <input type="checkbox" checked={s.prepared} onchange={() => togglePrepared(s.index)} />
            </label>
            <span class="name">{s.name}</span>
            <span class="lvl">{s.level}</span>
            <span class="src">{s.source}</span>
            <button class="rm" aria-label="Remove" onclick={() => removeSpell(s.index)}>×</button>
          </div>
          {#if s.tags.length > 0}
            <div class="tags">
              {#each s.tags as tag (tag.id)}
                <span class="tag" title={tag.label}><Icon name={tag.icon} /></span>
              {/each}
            </div>
          {/if}
        </li>
      {:else}
        <li class="nomatch">No spells match the selected tags.</li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .block { border: 1px solid var(--line); border-radius: 8px; padding: 0.75rem 1rem; }
  h3 { margin: 0 0 0.6rem; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .empty { color: var(--muted); font-size: 0.85rem; margin: 0; }

  .filterbar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    align-items: center;
    padding-bottom: 0.5rem;
    margin-bottom: 0.4rem;
    border-bottom: 1px solid var(--line);
  }
  .ftag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border: 1px solid var(--line);
    border-radius: 5px;
    background: var(--bg);
    color: var(--muted);
    cursor: pointer;
  }
  .ftag.on { background: var(--accent); border-color: var(--accent); color: #fff; }
  .ftag :global(.icon) { width: 0.95rem; height: 0.95rem; }
  .clear { font: inherit; font-size: 0.75rem; border: none; background: none; color: var(--accent); cursor: pointer; margin-left: 0.25rem; }

  ul { list-style: none; margin: 0; padding: 0; }
  li { padding: 0.3rem 0; border-bottom: 1px solid var(--line); }
  .top { display: flex; align-items: center; gap: 0.5rem; }
  .name { flex: 1; font-weight: 500; }
  .lvl { font-size: 0.72rem; color: var(--accent); }
  .src { font-size: 0.7rem; text-transform: uppercase; color: var(--muted); }
  .rm { background: none; border: none; color: var(--muted); font-size: 1.1rem; cursor: pointer; line-height: 1; }
  .rm:hover { color: var(--accent); }
  .tags { display: flex; flex-wrap: wrap; gap: 0.2rem; margin: 0.15rem 0 0 1.4rem; color: var(--muted); }
  .tag { display: inline-flex; }
  .tag :global(.icon) { width: 0.85rem; height: 0.85rem; }
  .nomatch { color: var(--muted); font-size: 0.85rem; }
</style>
