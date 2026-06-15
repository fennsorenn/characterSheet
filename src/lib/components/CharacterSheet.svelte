<script lang="ts">
  import { character, setName } from '../stores/character.js';
  import {
    editMode,
    toggleEdit,
    addBlock,
    resetLayout,
    layoutList,
    selectLayout,
    saveAsPreset,
    renameLayout,
    deleteLayout
  } from '../stores/layout.js';
  import { screenController } from '../stores/layout.js';
  import { setLayoutController } from '../layout/controller.js';
  import { BLOCK_META } from '../layout/blocks.js';
  import LayoutRenderer from './layout/LayoutRenderer.svelte';
  import ExplainPopover from './ExplainPopover.svelte';

  // The renderer below edits the active screen layout.
  setLayoutController(screenController);

  const blockTypes = Object.entries(BLOCK_META);
  let addType = $state('');
  let newPresetName = $state('');

  function onAdd(e: Event) {
    const type = (e.target as HTMLSelectElement).value;
    if (type) addBlock(type);
    addType = '';
  }

  function savePreset() {
    const name = newPresetName.trim();
    if (!name) return;
    saveAsPreset(name);
    newPresetName = '';
  }

  function renameActive() {
    const current = $layoutList.options.find((o) => o.id === $layoutList.activeId);
    const name = window.prompt('Rename layout', current?.name ?? '');
    if (name && name.trim()) renameLayout($layoutList.activeId, name.trim());
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
      <select
        class="preset"
        value={$layoutList.activeId}
        title="Layout preset"
        onchange={(e) => selectLayout((e.target as HTMLSelectElement).value)}
      >
        {#each $layoutList.options as opt}
          <option value={opt.id}>{opt.name}</option>
        {/each}
      </select>
      <button class="edit" class:on={$editMode} onclick={toggleEdit}>
        {$editMode ? 'Done' : 'Edit layout'}
      </button>
    </div>
  </div>

  {#if $editMode}
    <div class="editbar">
      <select value={addType} onchange={onAdd} title="Add a block">
        <option value="">+ Add block…</option>
        {#each blockTypes as [type, meta]}
          <option value={type}>{meta.label}</option>
        {/each}
      </select>
      <button onclick={resetLayout} title="Reset this layout's blocks">Reset blocks</button>
      <span class="spacer"></span>
      <input
        class="presetname"
        placeholder="Save as preset…"
        bind:value={newPresetName}
        onkeydown={(e) => e.key === 'Enter' && savePreset()}
      />
      <button onclick={savePreset}>Save as</button>
      <button onclick={renameActive}>Rename</button>
      <button
        class="danger"
        disabled={$layoutList.options.length <= 1}
        onclick={() => deleteLayout($layoutList.activeId)}
      >Delete</button>
    </div>
  {/if}

  <p class="tip">
    {#if $editMode}
      Drag to reorder, change a block's template/verbosity, resize, or remove it. Save arrangements as named presets.
    {:else}
      Every dotted value is computed — click it to see and trace the calculation.
    {/if}
  </p>

  <LayoutRenderer />
</div>

<ExplainPopover />

<style>
  .head { display: flex; align-items: center; gap: 1rem; }
  .char-name {
    flex: 1;
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
  .tools { display: flex; gap: 0.5rem; flex: none; }
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
  .tools select, .tools button, .editbar select, .editbar button, .editbar input {
    font: inherit;
    font-size: 0.85rem;
    padding: 0.35rem 0.7rem;
    border: 1px solid var(--line);
    background: var(--bg);
    color: var(--fg);
    border-radius: 6px;
    cursor: pointer;
  }
  .editbar input { cursor: text; }
  .edit.on { border-color: var(--accent); color: var(--accent); }
  .danger { color: var(--accent); border-color: var(--accent); }
  .danger:disabled { opacity: 0.4; cursor: not-allowed; }
  .tip { color: var(--muted); font-size: 0.85rem; margin: 0.5rem 0 1rem; }
</style>
