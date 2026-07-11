import { getContext, setContext } from 'svelte';
import type { Readable } from 'svelte/store';
import type { BlockSize, SheetLayout } from './types.js';

/**
 * Abstracts "a layout being edited" so the same renderer and block controls can
 * drive either the screen layout or the independent print layout. The host
 * (CharacterSheet / PrintView) provides a controller via context; LayoutRenderer
 * and BlockControls consume it, unaware of which layout they're editing.
 */
export interface LayoutController {
  layout: Readable<SheetLayout>;
  editMode: Readable<boolean>;
  addBlock(type: string): void;
  removeBlock(id: string): void;
  moveBlock(id: string, dir: -1 | 1): void;
  reorderBlock(fromId: string, toId: string): void;
  setVariant(id: string, variant: string): void;
  cycleSize(id: string): void;
  setSize(id: string, size: BlockSize): void;
  /** Toggle stacking this block below the previous one (split cell). */
  toggleStack(id: string): void;
}

const KEY = Symbol('layout-controller');

export function setLayoutController(controller: LayoutController): void {
  setContext(KEY, controller);
}

export function getLayoutController(): LayoutController {
  const controller = getContext<LayoutController>(KEY);
  if (!controller) throw new Error('No LayoutController in context');
  return controller;
}
