<script lang="ts">
  import { graph } from '../stores/character.js';
  import { openExplain } from '../stores/ui.js';
  import { labelForNode } from '../character/index.js';

  // A derived value that renders live and opens its computation on click.
  interface Props {
    node: string;
    label?: string;
    /** Show a leading +/- (bonuses) vs. a plain number (AC, DC, passives). */
    signed?: boolean;
  }
  let { node, label, signed = false }: Props = $props();

  const value = $derived($graph.has(node) ? $graph.get(node) : 0);
  const display = $derived(signed && value >= 0 ? `+${value}` : `${value}`);
</script>

<button
  class="stat-value"
  title="Show how this is calculated"
  onclick={() => openExplain(node, label ?? labelForNode(node))}
>
  {display}
</button>

<style>
  .stat-value {
    font: inherit;
    font-variant-numeric: tabular-nums;
    background: none;
    border: none;
    color: var(--fg);
    cursor: pointer;
    padding: 0;
    border-bottom: 1px dotted var(--muted);
  }
  .stat-value:hover { color: var(--accent); border-bottom-color: var(--accent); }
</style>
