<script lang="ts">
  import type { Snippet } from 'svelte';
  import { placeWindow, createDrag, type Rect } from './windowShell.js';

  /**
   * The shell the sheet's small floating windows share: placed beside whatever
   * opened it, draggable by its title bar, closed with the × or Escape. Callers
   * supply the header and body; everything about *where it sits* lives here.
   */
  let {
    anchor = null,
    width = 340,
    height = 300,
    label,
    onClose,
    header,
    children
  }: {
    anchor?: Rect | null;
    width?: number;
    height?: number;
    /** Accessible name for the dialog. */
    label: string;
    onClose: () => void;
    header: Snippet;
    children: Snippet;
  } = $props();

  let pos = $state({ x: 0, y: 0 });

  // Place it once, on the anchor it opened from; after that it stays where the
  // user drags it, even as its contents change.
  $effect(() => {
    void anchor;
    pos = placeWindow(anchor, { width, height }, { width: window.innerWidth, height: window.innerHeight });
  });

  const drag = createDrag(
    () => pos,
    (p) => (pos = p)
  );
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onClose()} />

<div class="win" style="left:{pos.x}px; top:{pos.y}px; width:{width}px;" role="dialog" aria-label={label}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <header class="bar" onpointerdown={drag.down} onpointermove={drag.move} onpointerup={drag.up}>
    {@render header()}
    <button class="ic" title="Close" aria-label="Close" onclick={onClose}>×</button>
  </header>
  {@render children()}
</div>

<style>
  .win {
    position: fixed;
    z-index: 60;
    display: flex;
    flex-direction: column;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 10px;
    box-shadow: 0 10px 30px rgb(0 0 0 / 0.18);
    overflow: hidden;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.4rem 0.35rem 0.6rem;
    border-bottom: 1px solid var(--line);
    background: var(--field-hover);
    cursor: grab;
    touch-action: none;
  }
  .ic {
    flex: none;
    font: inherit;
    line-height: 1;
    padding: 0.15rem 0.4rem;
    border: none;
    background: none;
    color: var(--muted);
    border-radius: 5px;
    cursor: pointer;
  }
  .ic:hover { color: var(--accent); }
</style>
