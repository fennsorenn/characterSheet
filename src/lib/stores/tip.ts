import { writable } from 'svelte/store';

/**
 * The one rules tooltip on screen.
 *
 * A single shared layer rather than a popup per trigger: only one can be open
 * at a time by definition, and anchoring one fixed-position element keeps it
 * clear of the blocks' scroll containers and stacking contexts.
 */

export interface TipContent {
  title: string;
  /** Where the wording comes from, shown small under the title. */
  source?: string;
  /** Pre-rendered HTML from the catalog's `entries` tree. */
  html: string;
}

export interface TipState extends TipContent {
  /** Viewport rect of the element that opened it, for placement. */
  anchor: DOMRect;
}

export const tip = writable<TipState | null>(null);

export function showTip(anchor: Element, content: TipContent) {
  tip.set({ ...content, anchor: anchor.getBoundingClientRect() });
}

export function hideTip() {
  tip.set(null);
}
