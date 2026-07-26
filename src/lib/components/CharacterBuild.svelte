<script lang="ts">
  import { canEditBuild } from '../stores/mode.js';
  import {
    character,
    setRace,
    setBackground,
    removeFeat,
    setSubclass,
    setClassLevel,
    removeClass
  } from '../stores/character.js';
  import { catalogState } from '../stores/catalog.js';
  import { openBrowse } from '../stores/browse.js';
  import UiIcon from './UiIcon.svelte';

  /**
   * What the character *is*: race, background, classes and feats. Everything
   * here is a choice that generates content elsewhere — the features, traits,
   * proficiencies and spells the rest of the sheet derives. It used to sit in
   * the header of the Features block, which conflated picking a class with
   * reading what the class gave you; separating them lets a finished character
   * drop this block entirely, or park it at the bottom of the sheet where
   * setup belongs.
   */
  let { variant = 'full' }: { variant?: string } = $props();

  const subclassesFor = (className: string) =>
    ($catalogState.catalog?.classData.subclass ?? []).filter(
      (s) => String(s.className).toLowerCase() === className.toLowerCase()
    );
</script>

<section class="block" data-variant={variant}>
  <header class="bhead">
    <h3>Race, Class &amp; Feats</h3>
  </header>

  <!-- Outside edit mode this reads as a summary rather than a form: what the
       character is, in text. Everything here defines the character, so there is
       nothing worth leaving as a field. -->
  <div class="setup">
    <div class="line">
      <span class="k">Race</span>
      {#if $character.race}
        <span class="v">{$character.race.name}</span>
        {#if $canEditBuild}
          <button class="x" onclick={() => setRace(undefined)} aria-label="Clear race"><UiIcon name="close" size="0.85em" /></button>
        {/if}
      {:else if $canEditBuild}
        <button class="choose" onclick={() => openBrowse('race')}>Choose…</button>
      {:else}
        <span class="none">—</span>
      {/if}
    </div>
    <div class="line">
      <span class="k">Background</span>
      {#if $character.background}
        <span class="v">{$character.background.name}</span>
        {#if $canEditBuild}
          <button class="x" onclick={() => setBackground(undefined)} aria-label="Clear background"><UiIcon name="close" size="0.85em" /></button>
        {/if}
      {:else if $canEditBuild}
        <button class="choose" onclick={() => openBrowse('background')}>Choose…</button>
      {:else}
        <span class="none">—</span>
      {/if}
    </div>
    <div class="line classes">
      <span class="k">Classes</span>
      {#each $character.classes as cls, i}
        <span class="classchip" class:plain={!$canEditBuild}>
          <span class="cname">{cls.name}</span>
          {#if $canEditBuild}
            <input
              class="lvl"
              type="number"
              min="1"
              max="20"
              value={cls.level}
              aria-label="{cls.name} level"
              title="{cls.name} level"
              onchange={(e) => setClassLevel(i, Number((e.target as HTMLInputElement).value) || 1)}
            />
            <select
              class="sub"
              value={cls.subclass ?? ''}
              title="Subclass"
              onchange={(e) => setSubclass(i, (e.target as HTMLSelectElement).value || undefined)}
            >
              <option value="">subclass…</option>
              {#each subclassesFor(cls.name) as sc}
                <option value={String(sc.shortName ?? sc.name)}>{sc.name}</option>
              {/each}
            </select>
            <button class="x" title="Remove class" onclick={() => removeClass(i)}><UiIcon name="close" size="0.85em" /></button>
          {:else}
            <span class="lvltext" aria-label="{cls.name} level">{cls.level}</span>
            {#if cls.subclass}<span class="subtext">{cls.subclass}</span>{/if}
          {/if}
        </span>
      {/each}
      {#if $canEditBuild}
        <button class="choose" onclick={() => openBrowse('class')}>+ Class</button>
      {/if}
    </div>
    <div class="line feats">
      <span class="k">Feats</span>
      {#each $character.feats as f, i}
        <span class="ctag">{f.name}{#if $canEditBuild}<button class="x" aria-label="Remove feat" onclick={() => removeFeat(i)}><UiIcon name="close" size="0.8em" /></button>{/if}</span>
      {/each}
      {#if $canEditBuild}
        <button class="choose" onclick={() => openBrowse('feat')}>+ Feat</button>
      {:else if !$character.feats.length}
        <span class="none">—</span>
      {/if}
    </div>
  </div>

  {#if !$catalogState.catalog}
    <p class="empty">Load game data to choose a race, class or feat.</p>
  {/if}
</section>

<style>
  .block { border: 1px solid var(--line); border-radius: 8px; padding: 0.75rem 1rem; }
  .bhead { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.6rem; }
  h3 { margin: 0; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .setup { display: flex; flex-direction: column; gap: 0.3rem; }
  /* A summary, not a dimmed form — so it stays readable. */
  .classchip.plain { border-style: dashed; }
  .lvltext { font-size: 0.78rem; color: var(--muted); font-variant-numeric: tabular-nums; }
  .subtext { font-size: 0.72rem; color: var(--muted); }
  .none { color: var(--muted); font-size: 0.8rem; }
  .line { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .k { font-size: 0.7rem; text-transform: uppercase; color: var(--muted); min-width: 6rem; }
  .v { font-weight: 600; }
  .choose, select { font: inherit; font-size: 0.78rem; padding: 0.15rem 0.5rem; border: 1px solid var(--line); background: var(--bg); color: var(--fg); border-radius: 6px; cursor: pointer; }
  .choose { color: var(--accent); border-color: var(--accent); }
  .ctag { display: inline-flex; align-items: center; gap: 0.1rem; font-size: 0.72rem; padding: 0.05rem 0.4rem; border: 1px solid var(--line); border-radius: 999px; }
  .classchip { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.1rem 0.3rem 0.1rem 0.5rem; border: 1px solid var(--line); border-radius: 8px; }
  .classchip .cname { font-weight: 600; font-size: 0.78rem; }
  .classchip .lvl { width: 6ch; min-width: 6ch; font: inherit; font-size: 0.76rem; text-align: center; padding: 0.05rem 0.25rem; border: 1px solid var(--line); border-radius: 4px; background: var(--bg); color: var(--fg); }
  .classchip .sub { font-size: 0.72rem; max-width: 11rem; }
  .x { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 0.95rem; line-height: 1; padding: 0; }
  .x:hover { color: var(--accent); }
  .empty { color: var(--muted); font-size: 0.85rem; margin: 0.5rem 0 0; }
</style>
