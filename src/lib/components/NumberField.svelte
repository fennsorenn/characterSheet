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
    width?: string;
  }
  let { value, onchange, min = -Infinity, max = Infinity, width = '2.5ch' }: Props = $props();

  import { applyNumberEdit, clampValue } from './numberEdit.js';

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

<input
  class="number-field"
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

<style>
  .number-field {
    font: inherit;
    font-variant-numeric: tabular-nums;
    text-align: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: var(--fg);
    padding: 0.1rem 0.15rem;
  }
  .number-field:hover { background: var(--field-hover); }
  .number-field:focus {
    outline: none;
    border-color: var(--accent);
    background: var(--bg);
  }
</style>
