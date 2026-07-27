<script lang="ts">
  import { dialTarget, closeDial } from '../stores/dial.js';
  import {
    canBeNegative,
    digitCells,
    flipSign,
    formatDelta,
    placeOf,
    setDigit,
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
    caret = null;
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

  let digitsEl = $state<HTMLInputElement | null>(null);

  /**
   * Where the caret should sit after an edit, restored once the field has been
   * rewritten. Rewriting the value puts the caret at the end, and a frame's
   * delay is too late — a fast typist (or a test) has already pressed the next
   * key, and every digit lands in the same place.
   */
  let caret = $state<number | null>(null);
  const caretTo = (pos: number) => (caret = Math.max(0, Math.min(pos, digits)));

  $effect(() => {
    void cells; // rerun once the digits have been written
    const el = digitsEl;
    const at = caret;
    if (el && at !== null && document.activeElement === el) el.setSelectionRange(at, at);
  });

  /**
   * Typing into the digit field.
   *
   * The field is a register of exactly `digits` characters, not free text: a
   * keystroke replaces the digit the caret is in front of and moves on, so the
   * columns never shift out from under the arrows mid-edit. Caught at
   * `beforeinput` and cancelled — the field is already full, so the browser
   * would refuse the insertion against `maxlength` and no `input` event would
   * arrive at all.
   */
  function typeDigits(e: Event) {
    const ev = e as InputEvent;
    const el = e.target as HTMLInputElement;
    const from = el.selectionStart ?? 0;
    const to = el.selectionEnd ?? from;

    if (ev.inputType === 'deleteContentBackward' || ev.inputType === 'deleteContentForward') {
      e.preventDefault();
      if (!target) return;
      // A selection clears the digits it covers; a bare backspace clears the one
      // behind the caret, the way a keypad does.
      const [lo, hi] =
        to > from
          ? [from, to]
          : ev.inputType === 'deleteContentBackward'
            ? [Math.max(0, from - 1), from]
            : [from, Math.min(digits, from + 1)];
      let next = draft;
      for (let i = lo; i < hi; i++) next = setDigit(next, placeOf(i, digits), 0, target.min, target.max);
      draft = next;
      typed = null;
      caretTo(lo);
      return;
    }

    const chars = [...(ev.data ?? '')].filter((c) => /\d/.test(c));
    if (!chars.length) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    if (!target) return;
    // Typing over a selection starts at its left edge, as it would in any field.
    let at = to > from ? from : from;
    let next = draft;
    for (const c of chars) {
      if (at >= digits) break;
      next = setDigit(next, placeOf(at, digits), Number(c), target.min, target.max);
      at += 1;
    }
    draft = next;
    typed = null;
    caretTo(at);
  }

  /** The field shows `draft`, never half-typed text. */
  function syncDigits(e: Event) {
    const el = e.target as HTMLInputElement;
    const want = digitCells(draft, digits).join('');
    if (el.value !== want) el.value = want;
  }

  function digitsKey(e: KeyboardEvent) {
    const el = e.target as HTMLInputElement;
    // The digit the caret is in front of — the one the next keystroke would
    // land on, and so the one the arrow keys should move.
    const pos = Math.min(Math.max(el.selectionStart ?? 0, 0), digits - 1);
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      step(pos, 1);
      caretTo(pos);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      step(pos, -1);
      caretTo(pos);
    }
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
        <!-- One field, not one per digit: a single caret you can see and move,
             ordinary selection and backspace. It lines up under the arrows
             because the digits are tabular and the letter-spacing is set to the
             column pitch, so every character lands in its own column. -->
        <div class="stack" style="--cols: {digits}">
          <div class="arrows">
            {#each cells as _, i}
              <button
                class="arrow up"
                aria-label="Increase by {placeOf(i, digits)}"
                disabled={!canStep(i, 1)}
                onclick={() => step(i, 1)}
              >▲</button>
            {/each}
          </div>
          <input
            class="digits"
            inputmode="numeric"
            aria-label="Digits"
            maxlength={digits}
            value={cells.join('')}
            bind:this={digitsEl}
            onbeforeinput={typeDigits}
            oninput={syncDigits}
            onblur={syncDigits}
            onkeydown={digitsKey}
          />
          <div class="arrows">
            {#each cells as _, i}
              <button
                class="arrow down"
                aria-label="Decrease by {placeOf(i, digits)}"
                disabled={!canStep(i, -1)}
                onclick={() => step(i, -1)}
              >▼</button>
            {/each}
          </div>
        </div>
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
  /* The digit field must read as the big plain number it replaced: no chrome,
     and one column per digit. `ch` is the advance of "0" and the numerals are
     tabular, so setting the letter-spacing to (column pitch − one digit) puts
     every character in its own column, and the indent centres it there. */
  .stack { display: flex; flex-direction: column; align-items: center; gap: 0.15rem; }
  .arrows { display: flex; gap: 0.4rem; }
  .digits {
    font: inherit;
    font-variant-numeric: tabular-nums;
    font-size: 1.7rem;
    font-weight: 700;
    line-height: 1.2;
    color: var(--fg);
    background: transparent;
    border: none;
    padding: 0;
    /* The trailing letter-space overhangs the last column; hide it rather than
       widening the box, which would knock the row off centre. */
    width: calc(var(--cols) * 2.8rem - 0.4rem);
    overflow: hidden;
    letter-spacing: calc(2.8rem - 1ch);
    text-indent: calc(1.2rem - 0.5ch);
    text-align: left;
    caret-color: var(--accent);
  }
  .digits:focus { outline: none; }
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
