/**
 * Shared behaviour for scrollable list blocks (features, spells, inventory):
 * cap the list's height so a long list scrolls instead of stretching the page,
 * and expose a vertical resize handle while editing the layout. The height is
 * persisted on the block instance (see `setHeight` in layout operations).
 *
 * Print is exempt — the `.print-pages .listscroll` rule in app.css removes the
 * cap so a printed sheet never clips its lists.
 */

/** Default height cap (px) when the user hasn't dragged a custom one yet. */
export const DEFAULT_SCROLL_HEIGHT = 480;

/** Inline style for a `.listscroll` region given the edit mode and stored height. */
export function scrollStyle(editing: boolean | undefined, height: number | undefined): string {
  const h = height ?? DEFAULT_SCROLL_HEIGHT;
  return editing
    ? `height:${h}px;overflow:auto;resize:vertical;min-height:4rem;`
    : `max-height:${h}px;overflow-y:auto;`;
}

export interface ResizeParams {
  editing?: boolean;
  height?: number;
  onResize?: (h: number) => void;
}

/**
 * Svelte action that persists a user resize of the region: on pointer-up it
 * reads the rendered height and reports it back, but only while editing and only
 * when it actually changed (so ordinary clicks inside the list don't churn the
 * layout). Implemented as an action rather than an inline handler so a plain
 * scroll `<div>` doesn't need an interactive ARIA role.
 */
export function resizePersist(node: HTMLElement, params: ResizeParams) {
  let p = params;
  const handler = () => {
    if (!p.editing || !p.onResize) return;
    const next = node.offsetHeight;
    if (Math.abs(next - (p.height ?? DEFAULT_SCROLL_HEIGHT)) > 2) p.onResize(next);
  };
  node.addEventListener('pointerup', handler);
  return {
    update(next: ResizeParams) {
      p = next;
    },
    destroy() {
      node.removeEventListener('pointerup', handler);
    }
  };
}
