/**
 * Modular sheet layout model.
 *
 * A sheet is data, not hard-coded markup: a {@link SheetLayout} is an ordered
 * list of {@link BlockInstance}s, each naming a registered block type, a chosen
 * verbosity variant, and a responsive size. This is the base the rest of the app
 * builds on — resources, buffs, etc. become new block types, and the print
 * layout is just another layout with a fixed page size.
 */

/** Verbosity tier a block variant renders at. */
export type Verbosity = 'minimal' | 'compact' | 'full';

/** Responsive width hint; the grid maps these to column spans per breakpoint. */
export type BlockSize = 'narrow' | 'wide' | 'full';

export const BLOCK_SIZES: BlockSize[] = ['narrow', 'wide', 'full'];

/** One placed section on the sheet. */
export interface BlockInstance {
  id: string;
  /** Registered block type key, e.g. 'abilityScores'. */
  type: string;
  /** Chosen variant key within the type, e.g. 'compact'. */
  variant: string;
  size: BlockSize;
  /**
   * When true, this block is stacked *below* the preceding block inside the same
   * grid cell (a "split cell") instead of occupying its own cell. The lead block
   * of the stack decides the cell's width. Ignored on the first block of a row.
   */
  stack?: boolean;
}

export interface SheetLayout {
  id: string;
  name: string;
  blocks: BlockInstance[];
}

/** Metadata describing a variant a block type can render at. */
export interface VariantMeta {
  key: string;
  label: string;
  verbosity: Verbosity;
}

/** Pure description of a block type (no UI), used by layout operations. */
export interface BlockMeta {
  label: string;
  variants: VariantMeta[];
  defaultVariant: string;
  defaultSize: BlockSize;
}
