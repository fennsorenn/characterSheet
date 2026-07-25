/**
 * Shared behaviour for the small floating windows (catalog details, reminder
 * explanations): where to put one so it doesn't cover what you clicked, and how
 * to drag it once it's open.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
}

/**
 * Place a window beside `anchor`: to its right if there is room, else its left,
 * else pinned to the right edge. Vertically it lines up with the anchor but is
 * kept fully on screen. With no anchor it sits in the bottom-right corner.
 */
export function placeWindow(
  anchor: Rect | null,
  size: { width: number; height: number },
  view: Viewport,
  gap = 12
): { x: number; y: number } {
  const { width, height } = size;
  if (!anchor) return { x: Math.max(8, view.width - width - 24), y: Math.max(8, view.height - height - 24) };
  const right = anchor.x + anchor.width;
  let x: number;
  if (view.width - right >= width + 24) x = right + gap;
  else if (anchor.x >= width + 24) x = anchor.x - width - gap;
  else x = view.width - width - gap;
  const y = Math.min(Math.max(anchor.y, 8), Math.max(8, view.height - height - 8));
  return { x: Math.max(8, x), y };
}

/**
 * Pointer-drag for a window's title bar, keeping enough of it on screen to grab
 * again. Ignores drags started on a control inside the bar.
 */
export function createDrag(get: () => { x: number; y: number }, set: (p: { x: number; y: number }) => void) {
  let from: { dx: number; dy: number } | null = null;
  return {
    down(e: PointerEvent) {
      if ((e.target as HTMLElement).closest('button, input, select, textarea')) return;
      const pos = get();
      from = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    },
    move(e: PointerEvent) {
      if (!from) return;
      set({
        x: Math.min(Math.max(0, e.clientX - from.dx), window.innerWidth - 60),
        y: Math.min(Math.max(0, e.clientY - from.dy), window.innerHeight - 32)
      });
    },
    up(e: PointerEvent) {
      from = null;
      (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    }
  };
}
