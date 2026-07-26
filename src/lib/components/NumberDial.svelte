<script lang="ts">
  import { dialTarget, closeDial } from '../stores/dial.js';
  import {
    canBeNegative,
    digitCells,
    flipSign,
    formatDelta,
    placeOf,
    stepDigit
  } from './numberDial.js';
  import { applyNumberEdit, clampValue } from './numberEdit.js';

  /**
   * The per-digit editor. Each digit has an arrow above and below it; the value
   * and the change it would make are shown together, because the number that
   * matters mid-session is usually "how much did that hit take off", not the
   * total. Nothing reaches the sheet until Apply — the running delta is only
   * honest if the starting point holds still.
   */

  let draft = $state(0);
  let started = $state(0);
  let typed = $state<string | null>(null);

  // A fresh target starts a fresh edit; the effect reads only the identity of
  // the target so retyping inside the dial does not reset it.
  $effect(() => {
    const t = $dialTarget;
    if (!t) return;
    draft = t.value;
    started = t.value;
    typed = null;
  });

  const target = $derived($dialTarget);
  const digits = $derived(target?.digits ?? 2);
  const cells = $derived(digitCells(draft, digits));
  const signed = $derived(target ? canBeNegative(target.min) : false);
  const delta = $derived(formatDelta(started, draft));

  function step(index: number, dir: 1 | -1) {
    if (!target) return;
    draft = stepDigit(draft, placeOf(index, digits), dir, target.min, target.max);
    typed = null;
  }

  /** Whether an arrow would move anything — a dead arrow is dimmed, not silent. */
  function canStep(index: number, dir: 1 | -1): boolean {
    if (!target) return false;
    return stepDigit(draft, placeOf(index, digits), dir, target.min, target.max) !== draft;
  }

  function commitTyped() {
    if (typed === null || !target) return;
    const next = applyNumberEdit(draft, typed);
    if (next !== null) draft = clampValue(next, target.min, target.max);
    typed = null;
  }

  function apply() {
    commitTyped();
    target?.onchange(draft);
    closeDial();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') closeDial();
    else if (e.key === 'Enter') apply();
  }
</script>

<svelte:window onkeydown={(e) => $dialTarget && onKey(e)} />

{#if target}
  <div
    class="backdrop"
    role="presentation"
    onclick={(e) => e.target === e.currentTarget && closeDial()}
  >
    <div class="dial" role="dialog" aria-modal="true" aria-label={target.label || 'Edit value'}>
      <header>
        <h2>{target.label || 'Edit value'}</h2>
        <button class="close" aria-label="Cancel" onclick={closeDial}>×</button>
      </header>

      <div class="wheels">
        {#if signed}
          <div class="col sign">
            <span class="spacer"></span>
            <button
              class="cell"
              aria-label="Flip sign"
              onclick={() => (draft = flipSign(draft, target.min, target.max))}
            >{draft < 0 ? '−' : '+'}</button>
            <span class="spacer"></span>
          </div>
        {/if}
        {#each cells as digit, i}
          <div class="col">
            <button
              class="arrow up"
              aria-label="Increase by {placeOf(i, digits)}"
              disabled={!canStep(i, 1)}
              onclick={() => step(i, 1)}
            >▲</button>
            <span class="cell digit">{digit}</span>
            <button
              class="arrow down"
              aria-label="Decrease by {placeOf(i, digits)}"
              disabled={!canStep(i, -1)}
              onclick={() => step(i, -1)}
            >▼</button>
          </div>
        {/each}
      </div>

      <div class="readout">
        <!-- The value stays a real field on every device: the dial is there so
             the keyboard doesn't come up unasked, not to lock it away. Tapping
             the number is the way back to typing, including "+7" deltas. -->
        <input
          class="val"
          aria-label="New value"
          inputmode="numeric"
          value={typed ?? String(draft)}
          oninput={(e) => (typed = (e.target as HTMLInputElement).value)}
          onfocus={(e) => (e.target as HTMLInputElement).select()}
          onblur={commitTyped}
        />
        <span class="delta" class:up={draft > started} class:down={draft < started}>{delta}</span>
      </div>
      <p class="from">was {started}</p>

      <footer>
        <button class="ghost" onclick={() => (draft = started)} disabled={draft === started}>Reset</button>
        <span class="gap"></span>
        <button class="ghost" onclick={closeDial}>Cancel</button>
        <button class="primary" onclick={apply}>Apply</button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    z-index: 320;
  }
  .dial {
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 12px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
    padding: 0.9rem 1rem 1rem;
    width: min(22rem, 100%);
  }
  header { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; }
  h2 { margin: 0; font-size: 1rem; color: var(--accent); }
  .close { font: inherit; font-size: 1.2rem; line-height: 1; background: none; border: none; color: var(--muted); cursor: pointer; padding: 0 0.2rem; }

  .wheels { display: flex; justify-content: center; gap: 0.4rem; margin: 0.8rem 0 0.5rem; }
  .col { display: flex; flex-direction: column; align-items: center; gap: 0.15rem; }
  .arrow {
    font: inherit;
    font-size: 0.8rem;
    line-height: 1;
    /* Comfortably tappable without a stylus — the whole point of the dial. */
    min-width: 2.4rem;
    padding: 0.5rem 0;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--bg);
    color: var(--muted);
    cursor: pointer;
  }
  .arrow:hover:not(:disabled) { color: var(--accent); border-color: var(--accent); }
  .arrow:disabled { opacity: 0.25; cursor: default; }
  .cell {
    font-variant-numeric: tabular-nums;
    font-size: 1.7rem;
    font-weight: 700;
    line-height: 1.2;
    min-width: 2.4rem;
    text-align: center;
  }
  .sign .cell { font: inherit; font-size: 1.5rem; border: none; background: none; color: var(--fg); cursor: pointer; }
  .sign .spacer { height: 2.05rem; }

  .readout { display: flex; align-items: baseline; justify-content: center; gap: 0.6rem; }
  .val {
    font: inherit;
    font-variant-numeric: tabular-nums;
    font-size: 1.15rem;
    font-weight: 700;
    text-align: center;
    width: 5ch;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    color: var(--fg);
    padding: 0.1rem 0.2rem;
  }
  .val:hover { background: var(--field-hover); }
  .val:focus { outline: none; border-color: var(--accent); background: var(--bg); }
  /* Same field, a finger-sized target: a 5ch box is a fiddly thing to tap. */
  @media (pointer: coarse) {
    .val { padding: 0.3rem 0.5rem; border-color: var(--line); }
  }
  .delta { font-variant-numeric: tabular-nums; font-size: 0.95rem; font-weight: 600; color: var(--muted); }
  .delta.up { color: #3fa45b; }
  .delta.down { color: #d2645a; }
  .from { margin: 0.1rem 0 0; text-align: center; font-size: 0.72rem; color: var(--muted); }

  footer { display: flex; align-items: center; gap: 0.4rem; margin-top: 0.9rem; }
  .gap { flex: 1; }
  footer button { font: inherit; font-size: 0.85rem; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; }
  .ghost { border: 1px solid var(--line); background: var(--bg); color: var(--fg); }
  .ghost:disabled { opacity: 0.4; cursor: default; }
  .primary { border: 1px solid var(--accent); background: var(--accent); color: #fff; font-weight: 600; }
</style>
