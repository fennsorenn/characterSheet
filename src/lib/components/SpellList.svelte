<script lang="ts">
  import { character, setSpellStatus, setSpellGranted, removeSpell } from '../stores/character.js';
  import { catalogLookup, catalogState } from '../stores/catalog.js';
  import {
    spellTags,
    spellStatus,
    grantedSpellsFromItems,
    featureGrantedSpells,
    choiceGrantedSpells,
    type SpellTag
  } from '../character/index.js';
  import Icon from './Icon.svelte';

  let { variant = 'full' }: { variant?: string } = $props();

  let selectedTags = $state<Set<string>>(new Set());
  let statusFilter = $state<'all' | 'prepared' | 'favorite' | 'known' | 'granted'>('all');

  interface Row {
    index: number | null; // null = derived from an equipped item
    name: string;
    source: string;
    status: 'known' | 'prepared' | 'favorite';
    grantedBy?: string;
    level: string;
    levelNum: number;
    tags: SpellTag[];
  }

  const granted = $derived.by(() => {
    const all = [
      ...grantedSpellsFromItems($character, $catalogLookup),
      ...($catalogState.catalog
        ? featureGrantedSpells($character, $catalogState.catalog, $catalogLookup)
        : []),
      ...choiceGrantedSpells($character)
    ];
    // Dedupe across items and features by spell name.
    const seen = new Set<string>();
    return all.filter((g) => (seen.has(g.name.toLowerCase()) ? false : seen.add(g.name.toLowerCase())));
  });

  const rows = $derived.by((): Row[] => {
    const manualKeys = new Set(
      $character.spells.map((s) => `${s.name}|${s.source}`.toLowerCase())
    );
    const base = [
      ...$character.spells.map((s, index) => ({
        index,
        name: s.name,
        source: s.source,
        status: spellStatus(s),
        grantedBy: s.grantedBy
      })),
      ...granted
        .filter((g) => !manualKeys.has(`${g.name}|${g.source}`.toLowerCase()))
        .map((g) => ({
          index: null,
          name: g.name,
          source: g.source,
          status: 'known' as const,
          grantedBy: g.grantedBy
        }))
    ];
    return base
      .map((r) => {
        const entry = $catalogLookup.getSpell(r.name, r.source);
        const levelNum = entry && typeof entry.level === 'number' ? entry.level : 99;
        const level = levelNum === 99 ? '' : levelNum === 0 ? 'cantrip' : `lvl ${levelNum}`;
        return { ...r, level, levelNum, tags: entry ? spellTags(entry) : [] };
      })
      .sort(
        (a, b) =>
          Number(!!a.grantedBy) - Number(!!b.grantedBy) ||
          a.levelNum - b.levelNum ||
          a.name.localeCompare(b.name)
      );
  });

  const counts = $derived.by(() => {
    const nonG = rows.filter((r) => !r.grantedBy);
    return {
      prepared: nonG.filter((r) => r.status === 'prepared').length,
      spellbook: nonG.length,
      favorite: nonG.filter((r) => r.status === 'favorite').length,
      granted: rows.filter((r) => r.grantedBy).length
    };
  });

  // Tag filter options (unique across rows).
  const allTags = $derived.by((): SpellTag[] => {
    const map = new Map<string, SpellTag>();
    for (const r of rows) for (const t of r.tags) if (!map.has(t.id)) map.set(t.id, t);
    return [...map.values()];
  });

  const shown = $derived(
    rows.filter((r) => {
      if (statusFilter === 'granted' && !r.grantedBy) return false;
      if (statusFilter !== 'granted' && statusFilter !== 'all') {
        if (r.grantedBy || r.status !== statusFilter) return false;
      }
      if (selectedTags.size) {
        const ids = new Set(r.tags.map((t) => t.id));
        if (![...selectedTags].every((id) => ids.has(id))) return false;
      }
      return true;
    })
  );

  function toggleTag(id: string) {
    const next = new Set(selectedTags);
    next.has(id) ? next.delete(id) : next.add(id);
    selectedTags = next;
  }

  const STATUS_FILTERS: [typeof statusFilter, string][] = [
    ['all', 'All'],
    ['prepared', 'Prepared'],
    ['favorite', 'Favorites'],
    ['granted', 'Granted']
  ];
</script>

<section class="block" data-variant={variant}>
  <header class="head">
    <h3>Spells</h3>
    {#if $character.spells.length > 0 || granted.length > 0}
      <span class="counts">
        <span title="Currently prepared">{counts.prepared} prep</span>
        <span title="In your spellbook (known)">· {counts.spellbook} book</span>
        <span title="Favorites — kept handy for swapping">· ★{counts.favorite}</span>
        {#if counts.granted}<span title="Granted by items/features — don't count, can't swap">· {counts.granted} granted</span>{/if}
      </span>
    {/if}
  </header>

  {#if $character.spells.length === 0 && granted.length === 0}
    <p class="empty">No spells — add them via quick import.</p>
  {:else}
    <div class="statusfilter">
      {#each STATUS_FILTERS as [val, label]}
        <button class:on={statusFilter === val} onclick={() => (statusFilter = val)}>{label}</button>
      {/each}
    </div>

    {#if allTags.length > 0}
      <div class="tagfilter">
        {#each allTags as tag (tag.id)}
          <button class="ftag" class:on={selectedTags.has(tag.id)} title={tag.label} onclick={() => toggleTag(tag.id)}>
            <Icon name={tag.icon} />
          </button>
        {/each}
        {#if selectedTags.size > 0}<button class="clear" onclick={() => (selectedTags = new Set())}>clear</button>{/if}
      </div>
    {/if}

    <ul>
      {#each shown as r (r.name + r.source)}
        <li class:granted={r.grantedBy}>
          <div class="top">
            {#if r.grantedBy}
              <span class="status gicon" title={`Granted by ${r.grantedBy} — always available, doesn't count`}>⚡</span>
            {:else if r.index !== null}
              <button
                class="status prep"
                class:on={r.status === 'prepared'}
                title="Prepared"
                onclick={() => setSpellStatus(r.index!, r.status === 'prepared' ? 'known' : 'prepared')}
              >✓</button>
              <button
                class="status fav"
                class:on={r.status === 'favorite'}
                title="Favorite — keep handy"
                onclick={() => setSpellStatus(r.index!, r.status === 'favorite' ? 'known' : 'favorite')}
              >★</button>
            {/if}
            <span class="name">{r.name}</span>
            <span class="lvl">{r.level}</span>
            {#if r.grantedBy}
              <span class="src gby" title="Granted by">{r.grantedBy}</span>
            {:else}
              <span class="src">{r.source}</span>
            {/if}
            {#if r.index !== null}
              <button
                class="grant"
                class:on={r.grantedBy}
                title={r.grantedBy ? 'Unmark granted' : 'Mark as granted by a feature/item'}
                onclick={() => setSpellGranted(r.index!, r.grantedBy ? undefined : 'Feature')}
              >⚑</button>
              <button class="rm" aria-label="Remove" onclick={() => removeSpell(r.index!)}>×</button>
            {/if}
          </div>
          {#if r.grantedBy && r.index !== null}
            <input
              class="gsource"
              value={r.grantedBy}
              title="Granting feature/item"
              onchange={(e) => setSpellGranted(r.index!, (e.target as HTMLInputElement).value)}
            />
          {/if}
          {#if r.tags.length > 0}
            <div class="tags">
              {#each r.tags as t (t.id)}<span class="tag" title={t.label}><Icon name={t.icon} /></span>{/each}
            </div>
          {/if}
        </li>
      {:else}
        <li class="empty">No spells match.</li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .block { border: 1px solid var(--line); border-radius: 8px; padding: 0.75rem 1rem; }
  .head { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
  h3 { margin: 0; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .counts { font-size: 0.72rem; color: var(--muted); }
  .empty { color: var(--muted); font-size: 0.85rem; margin: 0; }

  .statusfilter { display: flex; gap: 0.3rem; margin-bottom: 0.4rem; }
  .statusfilter button { font: inherit; font-size: 0.72rem; padding: 0.15rem 0.5rem; border: 1px solid var(--line); background: var(--bg); color: var(--muted); border-radius: 999px; cursor: pointer; }
  .statusfilter button.on { background: var(--accent); border-color: var(--accent); color: #fff; }

  .tagfilter { display: flex; flex-wrap: wrap; gap: 0.2rem; align-items: center; padding-bottom: 0.4rem; margin-bottom: 0.4rem; border-bottom: 1px solid var(--line); }
  .ftag { display: inline-flex; align-items: center; justify-content: center; width: 1.4rem; height: 1.4rem; border: 1px solid var(--line); border-radius: 5px; background: var(--bg); color: var(--muted); cursor: pointer; }
  .ftag.on { background: var(--accent); border-color: var(--accent); color: #fff; }
  .ftag :global(.icon) { width: 0.9rem; height: 0.9rem; }
  .clear { font: inherit; font-size: 0.7rem; border: none; background: none; color: var(--accent); cursor: pointer; }

  ul { list-style: none; margin: 0; padding: 0; }
  li { padding: 0.28rem 0; border-bottom: 1px solid var(--line); }
  li.granted { background: var(--field-hover); border-radius: 5px; padding: 0.28rem 0.3rem; }
  .top { display: flex; align-items: center; gap: 0.4rem; }
  .status { width: 1.3rem; height: 1.3rem; flex: none; font: inherit; font-size: 0.8rem; line-height: 1; border: 1px solid var(--line); background: var(--bg); color: var(--muted); border-radius: 4px; cursor: pointer; }
  .status.on { background: var(--accent); border-color: var(--accent); color: #fff; }
  .status.gicon { border: none; background: none; color: var(--accent); cursor: default; }
  .name { flex: 1; font-weight: 500; }
  .lvl { font-size: 0.72rem; color: var(--accent); }
  .src { font-size: 0.68rem; text-transform: uppercase; color: var(--muted); }
  .src.gby { text-transform: none; font-style: italic; color: var(--accent); }
  .grant { width: 1.3rem; height: 1.3rem; flex: none; font: inherit; font-size: 0.75rem; border: 1px solid var(--line); background: var(--bg); color: var(--muted); border-radius: 4px; cursor: pointer; }
  .grant.on { color: var(--accent); border-color: var(--accent); }
  .rm { background: none; border: none; color: var(--muted); font-size: 1.05rem; cursor: pointer; line-height: 1; }
  .rm:hover { color: var(--accent); }
  .gsource { margin: 0.2rem 0 0 1.7rem; width: calc(100% - 1.7rem); font: inherit; font-size: 0.75rem; padding: 0.15rem 0.3rem; border: 1px solid var(--line); border-radius: 4px; background: var(--bg); color: var(--fg); }
  .tags { display: flex; flex-wrap: wrap; gap: 0.18rem; margin: 0.15rem 0 0 1.7rem; color: var(--muted); }
  .tag :global(.icon) { width: 0.8rem; height: 0.8rem; }
</style>
