<script lang="ts">
  import { character, clearAllManualModifiers, clearManualModifier, MANUAL_SOURCE, characterLayoutPrefs, setCharacterLayoutPref } from '../stores/character.js';
  import { buffMode, toggleBuffMode, templateManagerOpen, dataPanelOpen } from '../stores/ui.js';
  import { reminderMode, toggleReminderMode } from '../stores/reminders.js';
  import { diceOpen } from '../stores/dice.js';
  import { catalogState } from '../stores/catalog.js';
  import { pinned, openDetail } from '../stores/detail.js';
  import { editMode, toggleEdit, layoutList, selectLayout } from '../stores/layout.js';
  import { screenCategory } from '../stores/screen.js';
  import { SCREEN_LABELS } from '../layout/screen.js';
  import { openPrint } from '../stores/print.js';
  import { navigate } from '../stores/router.js';
  import { dockView, toggleDockView, closeDock } from '../stores/dock.js';
  import { openBrowse } from '../stores/browse.js';
  import { activeBuffs } from '../character/buffs.js';
  import { sheetMode, cycleSheetMode, setSheetMode, SHEET_MODES, MODE_LABELS, MODE_HINTS } from '../stores/mode.js';
  import DiceBody from './DiceBody.svelte';
  import PinnedCreature from './PinnedCreature.svelte';
  import UiIcon from './UiIcon.svelte';
  import Icon from './Icon.svelte';

  /**
   * One dock for everything that used to be spread across three bars.
   *
   * It sits on an edge that depends on the viewport — the right on anything
   * desktop-sized, the bottom on a phone — and slides open in place rather than
   * spawning a menu. Pinned creatures live here too, so open statblocks and the
   * controls share one surface instead of fighting for the same corner.
   *
   * The two edges differ in what "open" means. The side rail has vertical room,
   * so it shows every section at once. The bottom dock does not, so its panel
   * shows one thing at a time and `dockView` says which.
   */
  let { backTo = '/local' }: { backTo?: string } = $props();

  const bottom = $derived($screenCategory === 'mobile');
  const open = $derived($dockView !== null);

  const buffs = $derived(activeBuffs($character, MANUAL_SOURCE));
  const reminderCount = $derived($character.reminders?.length ?? 0);

  /** Which creature's statblock is expanded, if any. */
  const openCreature = $derived($dockView?.kind === 'creature' ? $dockView.id : null);
  const menuShown = $derived($dockView?.kind === 'menu');
  const diceShown = $derived($dockView?.kind === 'dice');

  /** Whether this character pins the active template to the current screen size. */
  const pinnedHere = $derived($characterLayoutPrefs[$screenCategory] === $layoutList.activeId);

  // On a phone the roller lives in the dock's panel, so the two have to agree.
  // Which way the sync runs depends on what changed — hence the previous
  // values: reacting to the current state alone gives two rules that undo each
  // other (open the panel because dice is on / turn dice off because the panel
  // is not dice).
  let wasDiceOpen = false;
  let wasDiceShown = false;
  $effect(() => {
    const isOpen = $diceOpen;
    const isShown = diceShown;
    if (bottom) {
      if (isOpen && !wasDiceOpen) {
        // Opened by the Dice control, or by a roll fired from an attack.
        if (!isShown) dockView.set({ kind: 'dice' });
      } else if (!isOpen && wasDiceOpen && isShown) {
        closeDock();
      } else if (isOpen && !isShown && wasDiceShown) {
        // The panel moved to something else; the roller is no longer showing.
        diceOpen.set(false);
      }
    }
    wasDiceOpen = isOpen;
    wasDiceShown = isShown;
  });

  /**
   * Expanding a pinned creature. On a phone the statblock unfolds in the dock's
   * panel, because there is nowhere else for it; anywhere wider it goes to the
   * detail window, which can be dragged and read at a sensible width. The
   * creature's own params travel with it so a summon keeps the caster stats it
   * was pinned at.
   */
  function expandCreature(c: (typeof $pinned)[number], el?: HTMLElement) {
    if (bottom) {
      toggleDockView({ kind: 'creature', id: c.id });
      return;
    }
    openDetail('creature', c.entry, el ?? null, c.params?.spellLevel, c.params);
  }

  function onBrowse() {
    closeDock();
    // Browsing the catalog is a lookup, so it opens in any mode; whether a
    // result can be added to the character is the mode's business, not this
    // control's.
    openBrowse('item');
  }

  function onEditLayout() {
    closeDock();
    toggleEdit();
  }

  function togglePin() {
    setCharacterLayoutPref($screenCategory, pinnedHere ? undefined : $layoutList.activeId);
  }

  const MODE_ICON = { edit: '✎', play: '▶', read: '👁' } as const;

  const hp = (c: { hp: { current: number; max: number } }) =>
    c.hp.max > 0 ? Math.round((c.hp.current / c.hp.max) * 100) : 0;
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && open && closeDock()} />

{#snippet controls(inlineBuffs = false)}
  <button class="db" class:on={$diceOpen} title="Dice roller" onclick={() => diceOpen.update((v) => !v)}>
    <span class="g"><Icon name="dice" /></span><span class="lb">Dice</span>
  </button>
  <button class="db" class:on={$buffMode} disabled={$sheetMode === 'read'} title="Apply edits as temporary buffs/debuffs" onclick={toggleBuffMode}>
    <span class="g">✦</span><span class="lb">Buff</span>
    {#if buffs.length}<span class="ct">{buffs.length}</span>{/if}
  </button>
  {#if inlineBuffs && $buffMode}
    <!-- Under the toggle it belongs to, not in a section of its own. -->
    {@render buffList()}
  {/if}
  <button class="db" class:on={$reminderMode} title="Pin short notes next to skills, items, spells or whole blocks" onclick={toggleReminderMode}>
    <span class="g">◎</span><span class="lb">Notes</span>
    {#if reminderCount}<span class="ct">{reminderCount}</span>{/if}
  </button>
  <button class="db" title="Browse &amp; filter the catalog" onclick={onBrowse}>
    <span class="g">⌕</span><span class="lb">Add</span>
  </button>
  <button
    class="db mode mode-{$sheetMode}"
    title="{MODE_LABELS[$sheetMode]} mode — {MODE_HINTS[$sheetMode]} Click to change."
    onclick={cycleSheetMode}
  >
    <span class="g">{MODE_ICON[$sheetMode]}</span><span class="lb">{MODE_LABELS[$sheetMode]}</span>
  </button>
{/snippet}

{#snippet buffList()}
  <div class="sec">
    Active buffs
    <button class="clr" disabled={!buffs.length} onclick={clearAllManualModifiers}>
      Clear all ({buffs.length})
    </button>
  </div>
  <p class="hint">Type +2 / −1 on any value, or scroll it. Base values stay put.</p>
  {#each buffs as b (b.nodeId)}
    <div class="buff">
      <span class="wh">{b.label}</span>
      <span class="d" class:up={b.value > 0} class:dn={b.value < 0}>
        {b.value > 0 ? '+' : '−'}{Math.abs(b.value)}
      </span>
      <button class="x" title="Clear this buff" aria-label="Clear {b.label} buff" onclick={() => clearManualModifier(b.nodeId)}>×</button>
    </div>
  {:else}
    <p class="empty">Nothing buffed yet.</p>
  {/each}
{/snippet}

{#snippet menu()}
  <div class="sec">Mode</div>
  <div class="modes" role="group" aria-label="Sheet mode">
    {#each SHEET_MODES as m}
      <button class="seg" class:on={$sheetMode === m} title={MODE_HINTS[m]} onclick={() => setSheetMode(m)}>
        {MODE_ICON[m]} {MODE_LABELS[m]}
      </button>
    {/each}
  </div>
  <p class="hint">{MODE_HINTS[$sheetMode]}</p>

  <div class="sec">Sheet</div>
  <select
    class="preset"
    value={$layoutList.activeId}
    title="Layout template"
    onchange={(e) => selectLayout((e.target as HTMLSelectElement).value)}
  >
    {#each $layoutList.options as opt}<option value={opt.id}>{opt.name}</option>{/each}
  </select>
  <button class="db wide pin" class:on={pinnedHere} onclick={togglePin}>
    <span class="g">{pinnedHere ? '★' : '☆'}</span>
    <span class="lb">Always use on {SCREEN_LABELS[$screenCategory]}</span>
  </button>
  <button class="db wide" onclick={() => { closeDock(); templateManagerOpen.set(true); }}>
    <span class="g">▤</span><span class="lb">Templates…</span>
  </button>
  <button class="db wide" class:on={$editMode} onclick={onEditLayout}>
    <span class="g">▦</span><span class="lb">{$editMode ? 'Done editing layout' : 'Edit layout'}</span>
  </button>
  <button class="db wide" onclick={() => { closeDock(); openPrint(); }}>
    <span class="g">⎙</span><span class="lb">Print / PDF</span>
  </button>
  <button class="db wide" class:on={$dataPanelOpen} onclick={() => dataPanelOpen.update((v) => !v)}>
    <span class="g">↧</span>
    <span class="lb">{$catalogState.catalog ? 'Data' : 'Load data'}</span>
    {#if $catalogState.catalog}<span class="ok"><UiIcon name="check" size="0.85em" /></span>{/if}
  </button>
  <button class="db wide" onclick={() => navigate(backTo)}>
    <span class="g">←</span><span class="lb">Back to characters</span>
  </button>
{/snippet}

<aside class="dock" class:bottom class:side={!bottom} class:open aria-label="Sheet controls">
  {#if bottom}
    <!-- The panel: one section at a time, because a phone has no room for more. -->
    {#if open}
      <div class="grab"></div>
      <div class="panel">
        {#if diceShown}
          <DiceBody />
        {:else if menuShown}
          {#if $buffMode}{@render buffList()}{/if}
          {@render menu()}
        {:else if openCreature}
          {@const c = $pinned.find((p) => p.id === openCreature)}
          {#if c}<PinnedCreature {c} open onToggle={closeDock} />{/if}
        {/if}
      </div>
    {/if}

    {#if $pinned.length}
      <div class="creatures">
        {#each $pinned as c (c.id)}
          <button
            class="cb"
            class:on={openCreature === c.id}
            onclick={(e) => expandCreature(c, e.currentTarget)}
          >
            <span class="top">
              <span class="nm">{c.entry.name}</span>
              <span class="hpv">{c.hp.current}/{c.hp.max}</span>
            </span>
            <span class="bar"><i class:hurt={hp(c) <= 50} style="width:{hp(c)}%"></i></span>
          </button>
        {/each}
      </div>
    {/if}

    <div class="tabs">
      {@render controls()}
      <button class="db" class:on={menuShown} title="More" onclick={() => toggleDockView({ kind: 'menu' })}>
        <span class="g">⋯</span><span class="lb">More</span>
      </button>
    </div>
  {:else}
    <!-- The rail: every section at once, since there is vertical room. -->
    {#if open}
      <div class="sec">
        In play
        <button class="collapse" title="Collapse" aria-label="Collapse the dock" onclick={closeDock}>›</button>
      </div>
    {/if}
    {@render controls(open)}

    <div class="railscroll">
      {#if $pinned.length}
        {#if open}<div class="sec">Open creatures</div>{:else}<div class="hair"></div>{/if}
        {#each $pinned as c (c.id)}
          {#if open}
            <PinnedCreature {c} onToggle={(el) => expandCreature(c, el)} />
          {:else}
            <button
              class="stub"
              title="{c.entry.name} — {c.hp.current}/{c.hp.max} HP"
              onclick={(e) => expandCreature(c, e.currentTarget)}
            >
              <span class="sn">{c.entry.name.slice(0, 4)}</span>
              <small>{c.hp.current}/{c.hp.max}</small>
            </button>
          {/if}
        {/each}
      {/if}

      {#if open}
        {@render menu()}
      {:else}
        <div class="hair"></div>
        <button class="db" title="More" aria-label="Open the dock" onclick={() => toggleDockView({ kind: 'menu' })}>
          <span class="g">‹</span><span class="lb">More</span>
        </button>
      {/if}
    </div>
  {/if}
</aside>

<style>
  .dock {
    position: fixed;
    z-index: 120;
    background: var(--bg);
    border: 1px solid var(--line);
    display: flex;
    flex-direction: column;
  }

  /* --- shared control --- */
  .db {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    width: 100%;
    padding: 0.4rem 0.5rem;
    border-radius: 8px;
    cursor: pointer;
    position: relative;
    border: 1px solid transparent;
    background: none;
    color: var(--fg);
    font: inherit;
    font-size: 0.82rem;
    text-align: left;
    white-space: nowrap;
  }
  .db .g { flex: none; width: 1.5rem; text-align: center; font-size: 1.05rem; }
  .db .ct {
    margin-left: auto;
    font-size: 0.64rem;
    font-weight: 700;
    color: #fff;
    background: var(--accent);
    border-radius: 999px;
    padding: 0.02rem 0.34rem;
  }
  .db .ok { margin-left: auto; color: var(--muted); }
  .db.on { border-color: var(--accent); color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, var(--bg)); font-weight: 600; }
  .db:disabled { color: var(--muted); cursor: not-allowed; }
  /* Play and read are states worth spotting at a glance, so the control is
     tinted rather than merely labelled. */
  .db.mode-play { color: #3fa45b; }
  .db.mode-read { color: var(--muted); }
  .modes { display: flex; gap: 0.25rem; }
  .seg {
    flex: 1;
    font: inherit;
    font-size: 0.74rem;
    padding: 0.25rem 0.2rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--bg);
    color: var(--fg);
    cursor: pointer;
  }
  .seg.on { border-color: var(--accent); color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, var(--bg)); font-weight: 600; }

  .sec {
    display: flex;
    align-items: center;
    font-size: 0.6rem;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--muted);
    padding: 0.35rem 0.1rem 0.1rem;
  }
  .clr { margin-left: auto; text-transform: none; letter-spacing: 0; font: inherit; font-size: 0.68rem; color: var(--accent); cursor: pointer; background: none; border: none; padding: 0; }
  .clr:disabled { color: var(--muted); cursor: not-allowed; }
  .collapse {
    margin-left: auto;
    font: inherit;
    font-size: 1rem;
    line-height: 1;
    padding: 0 0.2rem;
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
  }
  .collapse:hover { color: var(--accent); }
  .hint { margin: 0; font-size: 0.68rem; color: var(--muted); padding: 0.1rem 0.2rem 0.25rem; }
  .empty { margin: 0; font-size: 0.72rem; color: var(--muted); font-style: italic; padding: 0.2rem 0.3rem 0.4rem; }
  .hair { height: 1px; background: var(--line); margin: 0.25rem 0.1rem; width: 100%; }

  /* --- a single active buff --- */
  .side .buff { flex: none; }
  .buff { display: flex; align-items: center; gap: 0.4rem; padding: 0.22rem 0.45rem; border: 1px solid var(--line); border-radius: 8px; font-size: 0.78rem; }
  .buff .wh { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .buff .d { font-weight: 700; font-variant-numeric: tabular-nums; }
  .buff .d.up { color: #3fa45b; }
  .buff .d.dn { color: #d2645a; }
  .buff .x { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 0.95rem; line-height: 1; padding: 0 0.1rem; }
  .buff .x:hover { color: var(--accent); }

  .preset { font: inherit; font-size: 0.78rem; padding: 0.25rem 0.4rem; border: 1px solid var(--line); border-radius: 6px; background: var(--bg); color: var(--fg); cursor: pointer; width: 100%; }

  /* --- side rail (desktop / tablet) --- */
  .side {
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    border-right: 0;
    border-radius: 12px 0 0 12px;
    box-shadow: -4px 0 18px rgba(0, 0, 0, 0.14);
    padding: 0.4rem 0.35rem;
    gap: 0.15rem;
    width: 3.4rem;
    align-items: center;
    max-height: 88vh;
    /* The rail itself never scrolls: the controls stay put and `.railscroll`
       takes the overflow, so they cannot be pushed off a short viewport. */
    overflow: hidden;
    transition: width 0.16s ease;
  }
  .side.open { width: 19.5rem; padding: 0.5rem; align-items: stretch; }
  .side:not(.open) .db { width: 2.5rem; height: 2.5rem; justify-content: center; padding: 0; }
  .side:not(.open) .db .lb { display: none; }
  .side:not(.open) .db .ct { position: absolute; top: -1px; right: -1px; margin: 0; }
  .railscroll {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    align-items: inherit;
    min-height: 0;
    /* Both axes named on purpose: setting only `overflow-y` leaves `overflow-x`
       computing to `auto`, and the buttons overhang their 42px column by two
       pixels — enough for a horizontal scrollbar under the expand button on
       any platform that draws classic (non-overlay) scrollbars. */
    overflow-x: hidden;
    overflow-y: auto;
    width: 100%;
  }
  .side:not(.open) .railscroll { align-items: center; }
  .stub { border: 1px solid var(--line); border-radius: 8px; width: 2.5rem; padding: 0.18rem; text-align: center; font: inherit; font-size: 0.6rem; font-weight: 700; color: var(--accent); background: var(--bg); cursor: pointer; }
  .stub small { display: block; font-weight: 400; color: var(--muted); font-size: 0.56rem; }

  /* --- bottom dock (mobile) --- */
  .bottom { left: 0; right: 0; bottom: 0; border-left: 0; border-right: 0; border-bottom: 0; box-shadow: 0 -5px 20px rgba(0, 0, 0, 0.16); }
  .grab { width: 2.2rem; height: 0.25rem; border-radius: 999px; background: var(--line); margin: 0.3rem auto 0.1rem; flex: none; }
  .panel { padding: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem; max-height: 54vh; overflow-x: hidden; overflow-y: auto; border-bottom: 1px solid var(--line); }
  .tabs { display: flex; align-items: stretch; }
  .tabs .db { flex-direction: column; gap: 0.1rem; align-items: center; justify-content: center; padding: 0.3rem 0.1rem; font-size: 0.58rem; }
  .tabs .db .g { width: auto; font-size: 1.1rem; }
  .tabs .db .ct { position: absolute; top: 0.05rem; right: 18%; margin: 0; }

  .creatures { display: flex; gap: 0.35rem; padding: 0.3rem 0.45rem; overflow-x: auto; overflow-y: hidden; border-bottom: 1px solid var(--line); }
  .cb { flex: none; min-width: 5.6rem; display: flex; flex-direction: column; align-items: flex-start; gap: 0.12rem; padding: 0.25rem 0.45rem; cursor: pointer; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--fg); font: inherit; }
  .cb.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, var(--bg)); }
  .cb.on .nm { color: var(--accent); }
  .cb .top { display: flex; align-items: baseline; gap: 0.35rem; width: 100%; }
  .cb .nm { font-size: 0.74rem; font-weight: 700; max-width: 7rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cb .hpv { font-size: 0.66rem; color: var(--muted); margin-left: auto; }
  .cb .bar { width: 100%; height: 0.2rem; border-radius: 999px; background: var(--line); overflow: hidden; }
  .cb .bar i { display: block; height: 100%; background: #3fa45b; }
  .cb .bar i.hurt { background: #d2645a; }

  @media print {
    .dock { display: none; }
  }
</style>
