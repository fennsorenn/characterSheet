<script lang="ts">
  import { character, setName } from '../stores/character.js';
  import { editMode, toggleEdit, addBlock, resetLayout } from '../stores/layout.js';
  import { BLOCK_META } from '../layout/blocks.js';
  import LayoutRenderer from './layout/LayoutRenderer.svelte';
  import ExplainPopover from './ExplainPopover.svelte';

  const blockTypes = Object.entries(BLOCK_META);
  let addType = $state('');

  function onAdd(e: Event) {
    const type = (e.target as HTMLSelectElement).value;
    if (type) addBlock(type);
    addType = '';
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
      {#if $editMode}
        <select value={addType} onchange={onAdd} title="Add a block">
          <option value="">+ Add block…</option>
          {#each blockTypes as [type, meta]}
            <option value={type}>{meta.label}</option>
          {/each}
        </select>
        <button onclick={resetLayout}>Reset</button>
      {/if}
      <button class="edit" class:on={$editMode} onclick={toggleEdit}>
        {$editMode ? 'Done' : 'Edit layout'}
      </button>
    </div>
  </div>

  <p class="tip">
    {#if $editMode}
      Drag blocks to reorder, change their template/verbosity, resize, or remove them.
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
  .tools select, .tools button {
    font: inherit;
    font-size: 0.85rem;
    padding: 0.35rem 0.7rem;
    border: 1px solid var(--line);
    background: var(--bg);
    color: var(--fg);
    border-radius: 6px;
    cursor: pointer;
  }
  .edit.on { border-color: var(--accent); color: var(--accent); }
  .tip { color: var(--muted); font-size: 0.85rem; margin: 0.25rem 0 1rem; }
</style>
