import { BLOCK_META } from './blocks.js';
import { BLOCK_SIZES, type BlockInstance, type BlockSize, type SheetLayout } from './types.js';

/**
 * Pure, immutable operations on a {@link SheetLayout}. Each returns a new layout
 * (never mutates), which keeps the store predictable and makes the editing logic
 * trivially testable and undo-friendly.
 */

/** Create a block instance for a type using its registered defaults. */
export function makeBlock(type: string): BlockInstance | null {
  const meta = BLOCK_META[type];
  if (!meta) return null;
  return {
    id: crypto.randomUUID(),
    type,
    variant: meta.defaultVariant,
    size: meta.defaultSize
  };
}

export function addBlock(layout: SheetLayout, type: string): SheetLayout {
  const block = makeBlock(type);
  if (!block) return layout;
  return { ...layout, blocks: [...layout.blocks, block] };
}

export function removeBlock(layout: SheetLayout, id: string): SheetLayout {
  return { ...layout, blocks: layout.blocks.filter((b) => b.id !== id) };
}

/** Move a block one slot earlier (dir -1) or later (dir +1). */
export function moveBlock(layout: SheetLayout, id: string, dir: -1 | 1): SheetLayout {
  const blocks = [...layout.blocks];
  const i = blocks.findIndex((b) => b.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= blocks.length) return layout;
  [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
  return { ...layout, blocks };
}

/** Reorder via drag: move `fromId` to occupy `toId`'s position. */
export function reorderBlock(layout: SheetLayout, fromId: string, toId: string): SheetLayout {
  if (fromId === toId) return layout;
  const blocks = [...layout.blocks];
  const from = blocks.findIndex((b) => b.id === fromId);
  const to = blocks.findIndex((b) => b.id === toId);
  if (from < 0 || to < 0) return layout;
  const [moved] = blocks.splice(from, 1);
  blocks.splice(to, 0, moved);
  return { ...layout, blocks };
}

export function setVariant(layout: SheetLayout, id: string, variant: string): SheetLayout {
  return mapBlock(layout, id, (b) => ({ ...b, variant }));
}

export function setSize(layout: SheetLayout, id: string, size: BlockSize): SheetLayout {
  return mapBlock(layout, id, (b) => ({ ...b, size }));
}

/** Cycle a block through narrow → wide → full → narrow. */
export function cycleSize(layout: SheetLayout, id: string): SheetLayout {
  return mapBlock(layout, id, (b) => {
    const next = BLOCK_SIZES[(BLOCK_SIZES.indexOf(b.size) + 1) % BLOCK_SIZES.length];
    return { ...b, size: next };
  });
}

/**
 * Toggle whether a block is stacked below the previous one (a split cell). The
 * first block can never stack (there is nothing above it), so toggling it is a
 * no-op that just clears any stray flag.
 */
export function toggleStack(layout: SheetLayout, id: string): SheetLayout {
  const i = layout.blocks.findIndex((b) => b.id === id);
  if (i <= 0) return mapBlock(layout, id, (b) => ({ ...b, stack: false }));
  return mapBlock(layout, id, (b) => ({ ...b, stack: !b.stack }));
}

function mapBlock(
  layout: SheetLayout,
  id: string,
  fn: (b: BlockInstance) => BlockInstance
): SheetLayout {
  return { ...layout, blocks: layout.blocks.map((b) => (b.id === id ? fn(b) : b)) };
}
