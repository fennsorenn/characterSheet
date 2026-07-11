<script lang="ts">
  import { character, graph, setSpellStatus, setSpellGranted, removeSpell } from '../stores/character.js';
  import { catalogLookup, catalogState } from '../stores/catalog.js';
  import { openDetail } from '../stores/detail.js';
  import { get } from 'svelte/store';
  import { rollParts, diceMode } from '../stores/dice.js';
  import { rollD20, rollTerms, parseDice } from '../dice/dice.js';
  import {
    spellTags,
    spellStatus,
    grantedSpellsFromItems,
    featureGrantedSpells,
    choiceGrantedSpells,
    casterClasses,
    assignSpellCounts,
    type SpellTag
  } from '../character/index.js';
  import Icon from './Icon.svelte';
  import UiIcon from './UiIcon.svelte';
  import QuickAdd from './QuickAdd.svelte';
  import { scrollStyle, resizePersist } from './scrollCell.js';

  let {
    variant = 'full',
    height = undefined,
    editing = false,
    onResize = undefined
  }: {
    variant?: string;
    height?: number;
    editing?: boolean;
    onResize?: (h: number) => void;
  } = $props();

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
    classes_: string[]; // base classes whose list includes this spell
    dmg: { dice: string; isAttack: boolean; type: string } | null;
  }

  // Pull the base damage dice + whether it's a spell attack from the spell text.
  function spellDamageInfo(entry: Record<string, unknown> | undefined) {
    if (!entry) return null;
    const text = JSON.stringify(entry.entries ?? '');
    const dice = text.match(/\{@(?:damage|scaledamage)\s+([0-9]+d[0-9]+(?:\s*[+-]\s*[0-9]+)?)/i)?.[1];
    if (!dice) return null;
    const isAttack = /\{@atkr?\b/i.test(text) || /spell attack/i.test(text);
    const type = Array.isArray(entry.damageInflict) ? String(entry.damageInflict[0] ?? '') : '';
    return { dice, isAttack, type };
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
    const spellKey = (name: string, source: string) => `${name}|${source}`.toLowerCase();
    // A grant takes precedence over a matching manual entry: the manual row is
    // shown as granted (⚡, doesn't count against limits) rather than duplicated,
    // so a spell you added manually and also picked via a feature (e.g. Magic
    // Initiate) reflects the grant. Keep its `index` so it stays removable.
    const grantBy = new Map(granted.map((g) => [spellKey(g.name, g.source), g.grantedBy]));
    const manualKeys = new Set($character.spells.map((s) => spellKey(s.name, s.source)));
    const base = [
      ...$character.spells.map((s, index) => ({
        index,
        name: s.name,
        source: s.source,
        status: spellStatus(s),
        grantedBy: s.grantedBy ?? grantBy.get(spellKey(s.name, s.source))
      })),
      ...granted
        .filter((g) => !manualKeys.has(spellKey(g.name, g.source)))
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
        const classes_ = (entry?._classes as string[] | undefined) ?? [];
        return { ...r, level, levelNum, tags: entry ? spellTags(entry) : [], classes_, dmg: spellDamageInfo(entry) };
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
    const leveled = nonG.filter((r) => r.levelNum > 0);
    return {
      cantrips: nonG.filter((r) => r.levelNum === 0).length,
      prepared: leveled.filter((r) => r.status === 'prepared').length,
      spellbook: leveled.length, // leveled spells known (cantrips counted separately)
      favorite: nonG.filter((r) => r.status === 'favorite').length,
      granted: rows.filter((r) => r.grantedBy).length
    };
  });

  // Per-class spellcasting limits + greedy assignment of spells to classes, so a
  // multiclass shows separate denominators (you can't prep a Cleric spell in a
  // Wizard slot). Ability mods come from the live graph (ASIs/feats reflected).
  const casters = $derived(
    $catalogState.catalog
      ? casterClasses(
          $character,
          $catalogState.catalog,
          (a) => ($graph.has(`ability.${a}.mod`) ? $graph.get(`ability.${a}.mod`) : 0),
          $graph.has('prof.bonus') ? $graph.get('prof.bonus') : 2
        )
      : []
  );
  const classCounts = $derived(
    assignSpellCounts(
      casters,
      rows
        .filter((r) => !r.grantedBy)
        .map((r) => ({ level: r.levelNum, classes: r.classes_, prepared: r.status === 'prepared' }))
    )
  );
  const over = (have: number, limit: number | null) => limit != null && have > limit;

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

  /** Roll a spell: a spell-attack d20 (if it's an attack) + its damage dice. */
  function rollSpell(r: Row) {
    if (!r.dmg) return;
    const parts = [];
    if (r.dmg.isAttack && $graph.has('spell.attack')) {
      parts.push(rollD20(get(diceMode), $graph.get('spell.attack'), 'Spell Attack', { modifierLabel: 'spell attack bonus' }));
    }
    const { terms, modifier } = parseDice(r.dmg.dice);
    parts.push(rollTerms(terms, modifier, `Damage${r.dmg.type ? ` ${r.dmg.type}` : ''}`));
    rollParts(r.name, parts);
  }

  function openSpellDetail(r: Row, el: Element) {
    const entry = $catalogLookup.getSpell(r.name, r.source);
    // Anchor to the whole block so the window opens beside the list, not over it.
    if (entry) openDetail('spell', entry, el.closest('.cell') ?? el);
  }

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
      {#if classCounts.length > 0}
        <span class="counts byclass">
          {#each classCounts as cc (cc.name)}
            <span class="clsgrp">
              {#if classCounts.length > 1}<span class="clsname">{cc.name}</span>{/if}
              {#if cc.cantripLimit != null}
                <span class:over={over(cc.cantripsUsed, cc.cantripLimit)} title="{cc.name} cantrips known / limit">{cc.cantripsUsed}/{cc.cantripLimit} cantrips</span>
              {/if}
              {#if cc.spellLimit != null}
                <span class:over={over(cc.spellsUsed, cc.spellLimit)} title="{cc.name} {cc.kind === 'prepared' ? 'prepared' : 'known'} leveled spells / limit">· {cc.spellsUsed}/{cc.spellLimit} {cc.kind === 'prepared' ? 'prep' : 'known'}</span>
              {/if}
              {#if cc.bookLimit != null}
                <span class="book" title="{cc.name} spellbook — leveled spells recorded / level total (wizards copy extra spells in, so exceeding this is normal)">· {cc.bookUsed}/{cc.bookLimit} book</span>
              {/if}
            </span>
          {/each}
          {#if counts.favorite}<span title="Favorites — kept handy for swapping"><UiIcon name="star" filled size="0.8em" />{counts.favorite}</span>{/if}
          {#if counts.granted}<span title="Granted by items/features — don't count, can't swap">{counts.granted} granted</span>{/if}
        </span>
      {:else}
        <span class="counts">
          <span title="Currently prepared">{counts.prepared} prep</span>
          <span title="Leveled spells in your spellbook">· {counts.spellbook} book</span>
          <span title="Favorites">· <UiIcon name="star" filled size="0.8em" />{counts.favorite}</span>
          {#if counts.granted}<span title="Granted by items/features">· {counts.granted} granted</span>{/if}
        </span>
      {/if}
    {/if}
  </header>

  {#if $character.spells.length === 0 && granted.length === 0}
    <p class="empty">No spells — add them with quick add below.</p>
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

    <div
      class="listscroll"
      style={scrollStyle(editing, height)}
      use:resizePersist={{ editing, height, onResize }}
    >
    <ul>
      {#each shown as r (r.name + r.source)}
        <li class:granted={r.grantedBy}>
          <div class="top">
            {#if r.grantedBy}
              <span class="status gicon" title={`Granted by ${r.grantedBy} — always available, doesn't count`}><Icon name="lightning" /></span>
            {:else if r.index !== null}
              <button
                class="status prep"
                class:on={r.status === 'prepared'}
                title="Prepared"
                onclick={() => setSpellStatus(r.index!, r.status === 'prepared' ? 'known' : 'prepared')}
              ><UiIcon name="check" /></button>
              <button
                class="status fav"
                class:on={r.status === 'favorite'}
                title="Favorite — keep handy"
                onclick={() => setSpellStatus(r.index!, r.status === 'favorite' ? 'known' : 'favorite')}
              ><UiIcon name="star" filled={r.status === 'favorite'} /></button>
            {/if}
            <button class="name" title="Show details" onclick={(e) => openSpellDetail(r, e.currentTarget)}>{r.name}</button>
            <span class="lvl">{r.level}</span>
            {#if r.grantedBy}
              <span class="src gby" title="Granted by">{r.grantedBy}</span>
            {:else}
              <span class="src">{r.source}</span>
            {/if}
            {#if r.dmg}
              <button class="roll" title="Roll {r.dmg.isAttack ? 'attack + ' : ''}damage ({r.dmg.dice})" aria-label="Roll {r.name}" onclick={() => rollSpell(r)}><Icon name="dice" /></button>
            {/if}
            {#if r.index !== null}
              <button
                class="grant"
                class:on={r.grantedBy}
                title={r.grantedBy ? 'Unmark granted' : 'Mark as granted by a feature/item'}
                onclick={() => setSpellGranted(r.index!, r.grantedBy ? undefined : 'Feature')}
              >⚑</button>
              <button class="rm" aria-label="Remove" onclick={() => removeSpell(r.index!)}><UiIcon name="close" size="0.85em" /></button>
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
    </div>
  {/if}
  <QuickAdd kind="spell" />
</section>

<style>
  .block { border: 1px solid var(--line); border-radius: 8px; padding: 0.75rem 1rem; }
  .head { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
  h3 { margin: 0; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .counts { font-size: 0.72rem; color: var(--muted); }
  .counts.byclass { display: flex; flex-wrap: wrap; gap: 0.1rem 0.6rem; align-items: baseline; }
  .clsgrp { display: inline-flex; gap: 0.25rem; align-items: baseline; }
  .clsname { font-weight: 700; color: var(--fg); text-transform: none; }
  .counts .over { color: #d2645a; font-weight: 600; }
  /* Spellbook count is informational — wizards copy extra spells in, so going
     over is expected; keep it muted, never the red over-limit style. */
  .counts .book { color: var(--muted); font-style: italic; }
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
  .top { display: flex; align-items: center; flex-wrap: wrap; gap: 0.3rem 0.4rem; }
  .status { width: 1.3rem; height: 1.3rem; flex: none; font: inherit; font-size: 0.8rem; line-height: 1; border: 1px solid var(--line); background: var(--bg); color: var(--muted); border-radius: 4px; cursor: pointer; }
  .status.on { background: var(--accent); border-color: var(--accent); color: #fff; }
  .status.gicon { border: none; background: none; color: var(--accent); cursor: default; }
  .name { flex: 1; min-width: 6ch; font-weight: 500; text-align: left; background: none; border: none; padding: 0; color: var(--fg); font: inherit; cursor: pointer; overflow-wrap: anywhere; }
  .name:hover { color: var(--accent); }
  .roll { font: inherit; font-size: 0.9rem; line-height: 1; padding: 0.05rem 0.3rem; border: 1px solid var(--accent); border-radius: 4px; background: var(--bg); color: var(--accent); cursor: pointer; }
  .roll:hover { background: var(--accent); color: #fff; }
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
