<script lang="ts">
  import { layout, editMode, reorderBlock } from '../../stores/layout.js';
  import { componentFor } from '../../layout/registry.js';
  import BlockControls from './BlockControls.svelte';

  // Renders the layout into a responsive grid. In edit mode each block gets a
  // control bar and becomes draggable for reordering. The grid maps block sizes
  // (narrow/wide/full) to column spans and reflows on small screens.
  let dragId = $state<string | null>(null);

  function onDrop(targetId: string) {
    if (dragId && dragId !== targetId) reorderBlock(dragId, targetId);
    dragId = null;
  }
</script>

<div class="grid" class:editing={$editMode}>
  {#each $layout.blocks as block (block.id)}
    {@const Block = componentFor(block.type)}
    <div
      class="cell size-{block.size}"
      class:drag-target={$editMode && dragId && dragId !== block.id}
      draggable={$editMode}
      ondragstart={() => (dragId = block.id)}
      ondragover={(e) => $editMode && e.preventDefault()}
      ondrop={() => onDrop(block.id)}
      role="group"
    >
      {#if $editMode}
        <BlockControls {block} />
      {/if}
      <div class="body">
        {#if Block}
          <Block variant={block.variant} />
        {:else}
          <p class="missing">Unknown block: {block.type}</p>
        {/if}
      </div>
    </div>
  {/each}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1rem;
    align-items: start;
  }
  .cell.size-narrow { grid-column: span 1; }
  .cell.size-wide { grid-column: span 2; }
  .cell.size-full { grid-column: span 4; }

  .editing .cell {
    border: 1px dashed var(--line);
    border-radius: 8px;
    overflow: hidden;
  }
  .editing .cell:hover { border-color: var(--accent); }
  .cell.drag-target { outline: 2px dashed var(--accent); outline-offset: 2px; }
  .missing { color: var(--accent); padding: 1rem; }

  @media (max-width: 900px) {
    .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .cell.size-full,
    .cell.size-wide { grid-column: span 2; }
    .cell.size-narrow { grid-column: span 1; }
  }
  @media (max-width: 560px) {
    .grid { grid-template-columns: 1fr; }
    .cell { grid-column: span 1 !important; }
  }
</style>
