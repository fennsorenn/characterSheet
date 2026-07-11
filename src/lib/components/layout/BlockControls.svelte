<script lang="ts">
  import { blockMeta } from '../../layout/blocks.js';
  import { getLayoutController } from '../../layout/controller.js';
  import { BLOCK_SIZES, type BlockInstance, type BlockSize } from '../../layout/types.js';

  // The edit-mode toolbar shown on each block: change variant, resize, split,
  // reorder, or remove. Drag handle lives here too (the parent cell is draggable).
  // Acts on whichever layout the surrounding controller manages.
  let { block }: { block: BlockInstance } = $props();
  const ctrl = getLayoutController();
  const meta = $derived(blockMeta(block.type));

  const SIZE_LABELS: Record<BlockSize, string> = { narrow: 'Narrow', wide: 'Wide', full: 'Full' };
</script>

<div class="controls">
  <span class="handle" title="Drag to reorder">⠿</span>
  <span class="title">{meta?.label ?? block.type}</span>

  {#if meta && meta.variants.length > 1}
    <select
      value={block.variant}
      title="Template / verbosity"
      onchange={(e) => ctrl.setVariant(block.id, (e.target as HTMLSelectElement).value)}
    >
      {#each meta.variants as v}
        <option value={v.key}>{v.label}</option>
      {/each}
    </select>
  {/if}

  <select
    class="size"
    value={block.stack ? '' : block.size}
    title="Width"
    disabled={!!block.stack}
    onchange={(e) => ctrl.setSize(block.id, (e.target as HTMLSelectElement).value as BlockSize)}
  >
    {#if block.stack}<option value="">—</option>{/if}
    {#each BLOCK_SIZES as size}
      <option value={size}>{SIZE_LABELS[size]}</option>
    {/each}
  </select>

  <button
    class="split"
    class:on={block.stack}
    title={block.stack ? 'Unstack into its own cell' : 'Stack below the block above (split cell)'}
    onclick={() => ctrl.toggleStack(block.id)}
  >⊟</button>
  <button title="Move up" onclick={() => ctrl.moveBlock(block.id, -1)}>↑</button>
  <button title="Move down" onclick={() => ctrl.moveBlock(block.id, 1)}>↓</button>
  <button class="rm" title="Remove" onclick={() => ctrl.removeBlock(block.id)}>✕</button>
</div>

<style>
  .controls {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.4rem;
    background: var(--field-hover);
    border-bottom: 1px solid var(--line);
    font-size: 0.75rem;
  }
  .handle { cursor: grab; color: var(--muted); }
  .title { flex: 1; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; }
  select, button {
    font: inherit;
    font-size: 0.75rem;
    border: 1px solid var(--line);
    background: var(--bg);
    color: var(--fg);
    border-radius: 4px;
    padding: 0.1rem 0.3rem;
    cursor: pointer;
  }
  .rm { color: var(--accent); border-color: var(--accent); }
  .split.on { color: var(--accent); border-color: var(--accent); }
  select:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
