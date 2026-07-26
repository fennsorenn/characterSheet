import { showTip, hideTip, tip, type TipContent } from '../stores/tip.js';
import { get } from 'svelte/store';

/**
 * Attach a rules tooltip to an element: hover it with a mouse, hold it on a
 * touchscreen, or focus it with a keyboard.
 *
 * Hold rather than tap because these live on controls that already do something
 * when tapped — a condition chip toggles the condition — so the press that
 * opens the explanation has to be told apart from the press that uses the
 * control, and the click it would otherwise fire is swallowed.
 */

/** How long a mouse rests before the tip appears. */
const HOVER_DELAY = 260;
/** How long a finger presses before it counts as a hold rather than a tap. */
const HOLD_DELAY = 420;
/** Movement (px) that turns a hold into a scroll. */
const HOLD_SLOP = 10;

export type TipParams = TipContent | null | undefined;

export function rulesTip(node: HTMLElement, params: TipParams) {
  let content = params;
  let hoverTimer: ReturnType<typeof setTimeout> | undefined;
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  let start: { x: number; y: number } | null = null;
  /** Set when a hold opened the tip, so the click it produces is discarded. */
  let swallowClick = false;
  let showing = false;

  const open = () => {
    if (!content) return;
    showTip(node, content);
    showing = true;
    node.setAttribute('aria-describedby', 'rules-tip');
  };

  const close = () => {
    clearTimeout(hoverTimer);
    clearTimeout(holdTimer);
    node.removeAttribute('aria-describedby');
    if (!showing) return;
    showing = false;
    hideTip();
  };

  const onenter = () => {
    if (!content) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(open, HOVER_DELAY);
  };

  const onleave = () => close();

  const ondown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' || !content) return;
    start = { x: e.clientX, y: e.clientY };
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => {
      swallowClick = true;
      open();
    }, HOLD_DELAY);
  };

  const onmove = (e: PointerEvent) => {
    if (!start) return;
    if (Math.abs(e.clientX - start.x) > HOLD_SLOP || Math.abs(e.clientY - start.y) > HOLD_SLOP) {
      clearTimeout(holdTimer);
      start = null;
    }
  };

  const onup = () => {
    clearTimeout(holdTimer);
    start = null;
  };

  // Capture, so the control's own click handler never sees the hold.
  const onclick = (e: MouseEvent) => {
    if (!swallowClick) return;
    swallowClick = false;
    e.preventDefault();
    e.stopPropagation();
  };

  // A held-open tip stays until it is dismissed; the context menu a long press
  // raises on some platforms would cover it.
  const oncontext = (e: Event) => {
    if (showing) e.preventDefault();
  };

  node.addEventListener('mouseenter', onenter);
  node.addEventListener('mouseleave', onleave);
  node.addEventListener('focus', open);
  node.addEventListener('blur', close);
  node.addEventListener('pointerdown', ondown);
  node.addEventListener('pointermove', onmove);
  node.addEventListener('pointerup', onup);
  node.addEventListener('pointercancel', onup);
  node.addEventListener('click', onclick, true);
  node.addEventListener('contextmenu', oncontext);

  return {
    update(next: TipParams) {
      content = next;
      // Content swapped under an open tip (the catalog finished loading): keep
      // it truthful rather than showing the wording it opened with.
      if (showing && get(tip)) open();
    },
    destroy() {
      close();
      node.removeEventListener('mouseenter', onenter);
      node.removeEventListener('mouseleave', onleave);
      node.removeEventListener('focus', open);
      node.removeEventListener('blur', close);
      node.removeEventListener('pointerdown', ondown);
      node.removeEventListener('pointermove', onmove);
      node.removeEventListener('pointerup', onup);
      node.removeEventListener('pointercancel', onup);
      node.removeEventListener('click', onclick, true);
      node.removeEventListener('contextmenu', oncontext);
    }
  };
}
