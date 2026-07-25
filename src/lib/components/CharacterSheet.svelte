<script lang="ts">
  import {
    character,
    setName,
    clearAllManualModifiers,
    characterLayoutPrefs,
    setCharacterLayoutPref,
    MANUAL_SOURCE
  } from '../stores/character.js';
  import {
    editMode,
    toggleEdit,
    addBlock,
    resetLayout,
    layoutList,
    selectLayout,
    applyPreferred,
    forkNotice,
    dismissFork,
    undoFork
  } from '../stores/layout.js';
  import { screenController } from '../stores/layout.js';
  import { screenCategory } from '../stores/screen.js';
  import { buffMode, toggleBuffMode } from '../stores/ui.js';
  import { reminderMode, toggleReminderMode, stranded } from '../stores/reminders.js';
  import { removeReminder } from '../stores/character.js';
  import { anchorLabel } from '../character/index.js';
  import { setLayoutController } from '../layout/controller.js';
  import { BLOCK_META } from '../layout/blocks.js';
  import { SCREEN_LABELS } from '../layout/screen.js';
  import LayoutRenderer from './layout/LayoutRenderer.svelte';
  import TemplateManager from './TemplateManager.svelte';
  import ExplainPopover from './ExplainPopover.svelte';

  const manualCount = $derived(
    $character.modifiers.filter((m) => m.source === MANUAL_SOURCE).length
  );
  const reminderCount = $derived($character.reminders?.length ?? 0);

  // The renderer below edits the active screen template.
  setLayoutController(screenController);
  dismissFork(); // a notice belongs to the sheet that raised it

  // Follow the preferred template as the viewport category or the character
  // changes. Picking one from the switcher overrides it until the next change.
  $effect(() => applyPreferred($screenCategory, $characterLayoutPrefs));

  const blockTypes = Object.entries(BLOCK_META);
  let addType = $state('');
  let showTemplates = $state(false);

  /** Whether this character pins the active template to the current screen size. */
  const pinnedHere = $derived($characterLayoutPrefs[$screenCategory] === $layoutList.activeId);
  /** The built-in templates are fixed; editing one lands in a copy instead. */
  const activeIsBuiltin = $derived(
    $layoutList.options.find((o) => o.id === $layoutList.activeId)?.builtin ?? false
  );

  function onAdd(e: Event) {
    const type = (e.target as HTMLSelectElement).value;
    if (type) addBlock(type);
    addType = '';
  }

  function togglePin() {
    setCharacterLayoutPref($screenCategory, pinnedHere ? undefined : $layoutList.activeId);
  }
</script>

<div class="sheet">
  <div class="head">
    <input
      class="char-name"
      value={$character.name}
      aria-label="Character name"
      oninput={(e) => setName((e.target as HTMLInputElement).value)}
    />
    <div class="tools">
      <button class="buff" class:on={$buffMode} onclick={toggleBuffMode} title="Apply edits as temporary buffs/debuffs">
        Buff mode{manualCount > 0 ? ` (${manualCount})` : ''}
      </button>
      <select
        class="preset"
        value={$layoutList.activeId}
        title="Layout template"
        onchange={(e) => selectLayout((e.target as HTMLSelectElement).value)}
      >
        {#each $layoutList.options as opt}
          <option value={opt.id}>{opt.name}</option>
        {/each}
      </select>
      <button
        class="pin"
        class:on={pinnedHere}
        onclick={togglePin}
        title={pinnedHere
          ? `${$character.name} always opens this template on ${SCREEN_LABELS[$screenCategory]} — click to unpin`
          : `Always use this template for ${$character.name} on ${SCREEN_LABELS[$screenCategory]}`}
      >
        {pinnedHere ? '★' : '☆'} {SCREEN_LABELS[$screenCategory]}
      </button>
      <button
        class:on={$reminderMode}
        onclick={toggleReminderMode}
        title="Pin short notes next to skills, items, spells or whole blocks"
      >Reminders{reminderCount > 0 ? ` (${reminderCount})` : ''}</button>
      <button class:on={showTemplates} onclick={() => (showTemplates = !showTemplates)}>
        Templates…
      </button>
      <button class="edit" class:on={$editMode} onclick={toggleEdit}>
        {$editMode ? 'Done' : 'Edit layout'}
      </button>
    </div>
  </div>

  {#if $forkNotice}
    <div class="fork-banner">
      <span>
        <strong>{$forkNotice.name}</strong> — the built-in template is fixed, so your change went
        into a copy of it. This sheet now uses the copy.
      </span>
      <span class="fork-actions">
        <button onclick={undoFork}>Undo</button>
        <button onclick={dismissFork}>Got it</button>
      </span>
    </div>
  {/if}

  {#if showTemplates}
    <TemplateManager onClose={() => (showTemplates = false)} />
  {/if}

  {#if $reminderMode}
    <div class="buff-banner reminder-banner">
      <span>
        <strong>Reminders</strong> — pin a short note under any skill, save, ability, attack,
        item, spell, or whole block. It stays with what it annotates, whatever template or
        screen size the sheet is on.
      </span>
      <button onclick={toggleReminderMode}>Done</button>
    </div>
  {/if}

  {#if $reminderMode && $stranded.length}
    <div class="buff-banner reminder-banner stranded">
      <span>
        <strong>Not on this sheet</strong> — these are pinned to something the current
        template doesn't show, or to an item or spell you no longer have:
        {#each $stranded as r (r.id)}
          <span class="orphan">
            <em>{r.text}</em> <span class="at">at {anchorLabel(r.anchor)}</span>
            <button class="drop" title="Delete reminder" onclick={() => removeReminder(r.id)}>✕</button>
          </span>
        {/each}
      </span>
    </div>
  {/if}

  {#if $buffMode}
    <div class="buff-banner">
      <span>
        <strong>Buff mode</strong> — edits apply as temporary buffs/debuffs on the value
        (type <code>+2</code>/<code>-1</code>, scroll, or arrow keys), leaving base values untouched.
      </span>
      <button onclick={clearAllManualModifiers} disabled={manualCount === 0}>
        Clear all ({manualCount})
      </button>
    </div>
  {/if}

  {#if $editMode}
    <div class="editbar">
      <select value={addType} onchange={onAdd} title="Add a block">
        <option value="">+ Add block…</option>
        {#each blockTypes as [type, meta]}
          <option value={type}>{meta.label}</option>
        {/each}
      </select>
      <button
        disabled={activeIsBuiltin}
        onclick={() => resetLayout($screenCategory)}
        title={activeIsBuiltin
          ? 'Built-in templates are already the shipped arrangement'
          : "Reset this template's blocks to the built-in arrangement"}
      >Reset blocks</button>
      <span class="spacer"></span>
      <button onclick={() => (showTemplates = true)}>Manage templates…</button>
    </div>
  {/if}

  <p class="tip">
    {#if $editMode}
      Drag to reorder, change a block's variant/verbosity, resize, or remove it. Save arrangements as
      named templates and pick one per screen size.
    {:else}
      Every dotted value is computed — click it to see and trace the calculation.
    {/if}
  </p>

  <LayoutRenderer />
</div>

<ExplainPopover />

<style>
  .head { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
  .char-name {
    flex: 1 1 12rem;
    min-width: 0;
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--fg);
    background: transparent;
    border: none;
    border-bottom: 1px solid transparent;
    padding: 0.1rem 0;
  }
  .char-name:hover { border-bottom-color: var(--line); }
  .char-name:focus { outline: none; border-bottom-color: var(--accent); }
  .tools { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .editbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 0.6rem;
    padding: 0.5rem;
    border: 1px dashed var(--line);
    border-radius: 8px;
  }
  .editbar .spacer { flex: 1; }
  .tools select, .tools button, .editbar select, .editbar button {
    font: inherit;
    font-size: 0.85rem;
    padding: 0.35rem 0.7rem;
    border: 1px solid var(--line);
    background: var(--bg);
    color: var(--fg);
    border-radius: 6px;
    cursor: pointer;
  }
  .tools button:disabled, .editbar button:disabled { opacity: 0.45; cursor: not-allowed; }
  .tools button.on, .edit.on { border-color: var(--accent); color: var(--accent); }
  .pin { white-space: nowrap; }
  .buff.on { border-color: var(--accent); background: var(--accent); color: #fff; }
  .fork-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 0.6rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--field-hover);
    font-size: 0.85rem;
  }
  .fork-actions { display: flex; gap: 0.4rem; flex: none; }
  .fork-banner button {
    font: inherit;
    font-size: 0.8rem;
    padding: 0.3rem 0.6rem;
    border: 1px solid var(--line);
    background: var(--bg);
    color: var(--fg);
    border-radius: 6px;
    cursor: pointer;
  }
  .buff-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 0.6rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--accent);
    border-radius: 8px;
    background: var(--field-hover);
    font-size: 0.85rem;
  }
  .buff-banner button {
    flex: none;
    font: inherit;
    font-size: 0.8rem;
    padding: 0.3rem 0.6rem;
    border: 1px solid var(--accent);
    background: var(--bg);
    color: var(--accent);
    border-radius: 6px;
    cursor: pointer;
  }
  .buff-banner button:disabled { opacity: 0.4; cursor: not-allowed; }
  .reminder-banner { border-color: var(--line); background: var(--field-hover); }
  .reminder-banner button { border-color: var(--line); color: var(--fg); }
  .stranded { align-items: flex-start; }
  .orphan {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    margin: 0.1rem 0.3rem 0 0;
    padding: 0.05rem 0.35rem;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--bg);
  }
  .orphan .at { color: var(--muted); font-size: 0.75rem; }
  .drop { font: inherit; font-size: 0.75rem; padding: 0 0.15rem; border: none; background: none; color: var(--muted); cursor: pointer; }
  .drop:hover { color: var(--accent); }
  .tip { color: var(--muted); font-size: 0.85rem; margin: 0.5rem 0 1rem; }
</style>
