<script lang="ts">
  import { diceOpen } from '../stores/dice.js';
  import { screenCategory } from '../stores/screen.js';
  import DiceBody from './DiceBody.svelte';
  import Icon from './Icon.svelte';

  /**
   * The roller as a draggable window. On a phone it doesn't render at all — the
   * dock hosts {@link DiceBody} instead, because a 300px window on a 420px
   * screen spent its life overlapping the dock it sat next to.
   */
  const WIDTH = 300;
  /** Clear of the dock's rail, which draws above this window. */
  const SIDE_DOCK = 60;

  let pos = $state<{ x: number; y: number } | null>(null);

  const floating = $derived($screenCategory !== 'mobile');

  // Default to the bottom-right corner the first time it opens, beside the rail.
  $effect(() => {
    if ($diceOpen && floating && !pos) {
      pos = {
        x: window.innerWidth - WIDTH - SIDE_DOCK,
        y: window.innerHeight - 360 - 20
      };
    }
  });

  // --- drag ---
  let drag: { dx: number; dy: number } | null = null;
  function down(e: PointerEvent) {
    if ((e.target as HTMLElement).closest('button, input, select')) return;
    if (!pos) return;
    drag = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (!drag) return;
    pos = {
      x: Math.min(Math.max(0, e.clientX - drag.dx), window.innerWidth - 60),
      y: Math.min(Math.max(0, e.clientY - drag.dy), window.innerHeight - 32)
    };
  }
  function up(e: PointerEvent) {
    drag = null;
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
  }
</script>

{#if $diceOpen && floating && pos}
  <div class="roller" style="left:{pos.x}px; top:{pos.y}px; width:{WIDTH}px;" role="dialog" aria-label="Dice roller">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <header class="bar" onpointerdown={down} onpointermove={move} onpointerup={up}>
      <span class="title"><Icon name="dice" /> Dice</span>
      <button class="ic" title="Close" aria-label="Close" onclick={() => diceOpen.set(false)}>×</button>
    </header>
    <DiceBody />
  </div>
{/if}

<style>
  .roller { position: fixed; z-index: 96; background: var(--bg); border: 1px solid var(--line); border-radius: 10px; box-shadow: 0 12px 40px rgba(0,0,0,0.35); display: flex; flex-direction: column; max-height: 75vh; }
  .bar { display: flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.5rem; border-bottom: 1px solid var(--line); cursor: grab; touch-action: none; }
  .bar:active { cursor: grabbing; }
  .title { flex: 1; font-weight: 700; font-size: 0.85rem; }
  .ic { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 1.05rem; line-height: 1; padding: 0 0.2rem; }
  .ic:hover { color: var(--accent); }
</style>
