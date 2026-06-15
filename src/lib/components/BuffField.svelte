<script lang="ts">
  import { character, graph, adjustNode, manualAdjustment } from '../stores/character.js';

  // A frameless field used in buff mode. It shows a node's *effective* value and
  // turns edits into a temporary modifier on that node (a buff/debuff):
  //  - "+2" / "-1"  → apply that delta
  //  - "18"         → adjust so the effective total becomes 18
  //  - scroll / arrows → ±1 (Shift = ±5)
  // The base value and other modifiers are never touched.
  interface Props {
    node: string;
    signed?: boolean;
    width?: string;
  }
  let { node, signed = false, width = '2.5ch' }: Props = $props();

  let editing = $state('');
  let focused = $state(false);

  const effective = $derived($graph.has(node) ? $graph.get(node) : 0);
  const adjustment = $derived(manualAdjustment($character, node));
  const shown = $derived(signed && effective >= 0 ? `+${effective}` : `${effective}`);

  function commit() {
    const raw = editing.trim();
    editing = '';
    focused = false;
    if (/^[+-]\d+$/.test(raw)) adjustNode(node, Number(raw));
    else if (raw !== '' && !Number.isNaN(Number(raw))) adjustNode(node, Number(raw) - effective);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      commit();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      adjustNode(node, e.shiftKey ? 5 : 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      adjustNode(node, e.shiftKey ? -5 : -1);
    }
  }
</script>

<input
  class="buff-field"
  class:adjusted={adjustment !== 0}
  class:up={adjustment > 0}
  class:down={adjustment < 0}
  style="width: {width}"
  value={focused ? editing : shown}
  inputmode="numeric"
  title={adjustment !== 0 ? `Manual buff ${adjustment > 0 ? '+' : ''}${adjustment}` : 'Buff mode: type +N/-N to buff/debuff'}
  onfocus={(e) => {
    focused = true;
    editing = '';
    (e.target as HTMLInputElement).select();
  }}
  oninput={(e) => (editing = (e.target as HTMLInputElement).value)}
  onblur={commit}
  onkeydown={onKey}
  onwheel={(e) => {
    e.preventDefault();
    adjustNode(node, Math.sign(-e.deltaY) * (e.shiftKey ? 5 : 1));
  }}
/>

<style>
  .buff-field {
    font: inherit;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    text-align: center;
    background: transparent;
    border: 1px dashed var(--accent);
    border-radius: 4px;
    color: var(--fg);
    padding: 0.05rem 0.15rem;
  }
  .buff-field:focus { outline: none; border-style: solid; background: var(--bg); }
  .buff-field.up { color: #3fa45b; border-color: #3fa45b; }
  .buff-field.down { color: #d2645a; border-color: #d2645a; }
</style>
