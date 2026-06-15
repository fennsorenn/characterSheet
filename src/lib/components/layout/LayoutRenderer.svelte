<script lang="ts">
  import { getLayoutController } from '../../layout/controller.js';
  import { componentFor } from '../../layout/registry.js';
  import BlockControls from './BlockControls.svelte';

  // Renders the controller's layout into a responsive grid. In edit mode each
  // block gets a control bar and becomes draggable for reordering. The grid maps
  // block sizes (narrow/wide/full) to column spans and reflows on small screens.
  // The controller (screen vs print) comes from context, so this is reused as-is.
  const ctrl = getLayoutController();
  const layout = ctrl.layout;
  const editMode = ctrl.editMode;
  let dragId = $state<string | null>(null);

  function onDrop(targetId: string) {
    if (dragId && dragId !== targetId) ctrl.reorderBlock(dragId, targetId);
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
  /* A real 12-column grid that fills the available width. Block sizes map to
     column spans that scale across breakpoints; `dense` packs blocks to fill
     gaps left by differing spans. Full-width blocks always span every column. */
  .grid {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    grid-auto-flow: row dense;
    gap: 1rem;
    align-items: start;
  }
  .cell.size-narrow { grid-column: span 3; }
  .cell.size-wide { grid-column: span 6; }
  .cell.size-full { grid-column: 1 / -1; }

  /* Ultrawide: pack more blocks per row. */
  @media (min-width: 1700px) {
    .cell.size-narrow { grid-column: span 2; }
    .cell.size-wide { grid-column: span 4; }
  }
  /* Tablet: narrow → half, wide → full. */
  @media (max-width: 1100px) {
    .cell.size-narrow { grid-column: span 6; }
    .cell.size-wide { grid-column: 1 / -1; }
  }
  /* Mobile: single column. */
  @media (max-width: 680px) {
    .cell.size-narrow,
    .cell.size-wide { grid-column: 1 / -1; }
  }

  .editing .cell {
    border: 1px dashed var(--line);
    border-radius: 8px;
    overflow: hidden;
  }
  .editing .cell:hover { border-color: var(--accent); }
  .cell.drag-target { outline: 2px dashed var(--accent); outline-offset: 2px; }
  .missing { color: var(--accent); padding: 1rem; }
</style>
