<script lang="ts">
  import { graph } from '../stores/character.js';
  import { openExplain, buffMode } from '../stores/ui.js';
  import { labelForNode } from '../character/index.js';
  import BuffField from './BuffField.svelte';

  // A derived value that renders live and opens its computation on click. In buff
  // mode (and when adjustable) it becomes an editable field that buffs/debuffs
  // the node instead.
  interface Props {
    node: string;
    label?: string;
    /** Show a leading +/- (bonuses) vs. a plain number (AC, DC, passives). */
    signed?: boolean;
    /** Whether buff mode may turn this into an editable buff field. */
    adjustable?: boolean;
  }
  let { node, label, signed = false, adjustable = true }: Props = $props();

  const value = $derived($graph.has(node) ? $graph.get(node) : 0);
  const display = $derived(signed && value >= 0 ? `+${value}` : `${value}`);
</script>

{#if $buffMode && adjustable}
  <BuffField {node} {signed} />
{:else}
  <button
    class="stat-value"
    title="Show how this is calculated"
    onclick={() => openExplain(node, label ?? labelForNode(node))}
  >
    {display}
  </button>
{/if}

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
