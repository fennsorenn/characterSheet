<script lang="ts">
  import { tip, hideTip } from '../stores/tip.js';

  /**
   * The shared tooltip layer — mounted once, positioned against whatever opened
   * it. Fixed rather than absolute so a block's scroll container can't clip it,
   * and measured after render so it can flip above/below and stay on screen.
   */

  let el = $state<HTMLElement | null>(null);
  let placed = $state(false);
  let pos = $state({ left: 0, top: 0 });

  const MARGIN = 8;

  $effect(() => {
    const t = $tip;
    if (!t || !el) {
      placed = false;
      return;
    }
    const box = el.getBoundingClientRect();
    let left = t.anchor.left + t.anchor.width / 2 - box.width / 2;
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - box.width - MARGIN));
    // Above by default: the anchor is usually a control the pointer is on.
    let top = t.anchor.top - box.height - MARGIN;
    if (top < MARGIN) top = Math.min(t.anchor.bottom + MARGIN, window.innerHeight - box.height - MARGIN);
    pos = { left, top: Math.max(MARGIN, top) };
    placed = true;
  });
</script>

<svelte:window
  onkeydown={(e) => e.key === 'Escape' && hideTip()}
  onscrollcapture={() => hideTip()}
  onresize={() => hideTip()}
  onpointerdown={(e) => {
    // A tap anywhere else puts a held-open tip away.
    if ($tip && el && !el.contains(e.target as Node)) hideTip();
  }}
/>

{#if $tip}
  <div
    bind:this={el}
    id="rules-tip"
    class="rulestip"
    class:placed
    role="tooltip"
    style="left: {pos.left}px; top: {pos.top}px"
  >
    <div class="th">
      <strong>{$tip.title}</strong>
      {#if $tip.source}<span class="src">{$tip.source}</span>{/if}
    </div>
    <div class="tb">{@html $tip.html}</div>
  </div>
{/if}

<style>
  .rulestip {
    position: fixed;
    z-index: 300;
    max-width: min(24rem, calc(100vw - 1rem));
    padding: 0.5rem 0.7rem 0.6rem;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--bg);
    color: var(--fg);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
    font-size: 0.82rem;
    line-height: 1.4;
    /* Placement needs a measured box, so the first frame is laid out unseen. */
    visibility: hidden;
    pointer-events: none;
  }
  .rulestip.placed { visibility: visible; }
  .th { display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 0.25rem; }
  .th strong { color: var(--accent); }
  .src { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .tb :global(p) { margin: 0 0 0.4rem; }
  .tb :global(p:last-child) { margin-bottom: 0; }
  .tb :global(ul) { margin: 0; padding-left: 1.1rem; }
  .tb :global(li) { margin-bottom: 0.2rem; }
  .tb :global(table) { border-collapse: collapse; margin-top: 0.3rem; font-size: 0.95em; }
  .tb :global(th), .tb :global(td) { border: 1px solid var(--line); padding: 0.1rem 0.35rem; text-align: left; }
</style>
