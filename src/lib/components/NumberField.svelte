<script lang="ts">
  // Frameless number input optimised for "view, but edit in place":
  //  - looks like plain text until focused
  //  - "+2" / "-1" entries apply a delta instead of an absolute value
  //  - scroll or arrow keys nudge (Shift = ±5)
  interface Props {
    value: number;
    onchange: (value: number) => void;
    min?: number;
    max?: number;
    /**
     * How many digits the field must show without clipping. The component adds
     * the slack, so callers never have to guess how much a `ch` really buys.
     * Left out, it comes from the bounds — a field capped at 30 needs two.
     */
    digits?: number;
    /** Read-only: the value still shows, but nothing can change it. */
    locked?: boolean;
    /** Accessible name — the field is frameless, so its label is elsewhere. */
    label?: string;
  }
  let {
    value,
    onchange,
    min = -Infinity,
    max = Infinity,
    digits = undefined,
    locked = false,
    label = undefined
  }: Props = $props();

  import { applyNumberEdit, clampValue } from './numberEdit.js';
  import { digitsFor } from './numberDial.js';
  import { dialEnabled, openDial } from '../stores/dial.js';

  const places = $derived(digits ?? digitsFor(min, max));
  // `ch` is the advance of "0", and the digits are tabular, so N digits are
  // exactly N ch; half a character of slack keeps them off the edges. A field
  // that can go negative needs room for the sign as well.
  const width = $derived(`calc(${places + (min < 0 ? 1 : 0)}ch + 0.5ch)`);

  let editing = $state('');
  let focused = $state(false);

  const clamp = (n: number) => clampValue(n, min, max);
  const display = $derived(focused ? editing : String(value));

  function commit() {
    const raw = editing;
    // Clear first so a follow-up blur after Enter doesn't re-apply a delta.
    editing = '';
    focused = false;
    const next = applyNumberEdit(value, raw);
    if (next !== null) onchange(clamp(next));
  }

  function nudge(delta: number) {
    onchange(clamp(value + delta));
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      commit();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      nudge(e.shiftKey ? 5 : 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      nudge(e.shiftKey ? -5 : -1);
    }
  }
</script>

{#if locked}
  <!-- Locked values read as text. A disabled input still looks like a
       field, which invites the click it is going to refuse. -->
  <span class="number-field locked" style="width: {width}" aria-label={label}>{value}</span>
{:else if $dialEnabled}
  <!-- No input element at all: focusing one is what raises the keyboard the
       dial exists to avoid. -->
  <button
    type="button"
    class="number-field dial"
    aria-label={label}
    style="width: {width}"
    onclick={() =>
      openDial({ label: label ?? 'Edit value', value, min, max, digits: places, onchange })}
  >{value}</button>
{:else}
  <input
    class="number-field"
    aria-label={label}
    style="width: {width}"
    value={display}
    inputmode="numeric"
    onfocus={(e) => {
      focused = true;
      editing = String(value);
      (e.target as HTMLInputElement).select();
    }}
    oninput={(e) => (editing = (e.target as HTMLInputElement).value)}
    onblur={commit}
    onkeydown={onKey}
    onwheel={(e) => {
      e.preventDefault();
      nudge(Math.sign(-e.deltaY) * (e.shiftKey ? 5 : 1));
    }}
  />
{/if}

<style>
  /* Same metrics as the input so nothing shifts when the mode changes. */
  span.number-field { display: inline-block; cursor: default; }
  button.number-field { display: inline-block; cursor: pointer; }
  /* The dotted underline the sheet uses for "there is more behind this". */
  button.number-field.dial { text-decoration: underline dotted var(--line); text-underline-offset: 0.2em; }
  .number-field {
    font: inherit;
    font-variant-numeric: tabular-nums;
    text-align: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: var(--fg);
    padding: 0.1rem 0.15rem;
    /* The app is border-box, which would make the width include the padding and
       focus border and leave the field ~7px short — enough to clip a two-digit
       score. Here the width covers the digits alone. */
    box-sizing: content-box;
  }
  .number-field:hover { background: var(--field-hover); }
  .number-field:focus {
    outline: none;
    border-color: var(--accent);
    background: var(--bg);
  }
</style>
