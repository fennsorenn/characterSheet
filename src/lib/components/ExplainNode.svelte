<script lang="ts">
  import type { Explanation } from '../calc/index.js';
  import { labelForNode } from '../character/index.js';
  import Self from './ExplainNode.svelte';

  // Recursively renders one node of a calc explanation tree.
  interface Props {
    node: Explanation;
    depth?: number;
  }
  let { node, depth = 0 }: Props = $props();

  const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
  // Hide the multiplier helper inputs; they're an implementation detail.
  const visibleDeps = $derived(node.dependencies.filter((d) => !d.id.endsWith('.profMult')));
</script>

<div class="node" style="--depth: {depth}">
  <div class="row">
    <span class="label">{labelForNode(node.id)}</span>
    <span class="value">{node.value}</span>
  </div>

  {#if node.base !== undefined && (node.modifiers.length > 0 || visibleDeps.length > 0)}
    <div class="detail">base {node.base}</div>
  {/if}

  {#each node.modifiers as mod}
    <div class="detail mod" class:dropped={!mod.applied}>
      {mod.source}: {signed(mod.value)}{mod.type ? ` (${mod.type})` : ''}
      {!mod.applied ? '— superseded' : ''}
    </div>
  {/each}

  {#each visibleDeps as dep (dep.id)}
    <Self node={dep} depth={depth + 1} />
  {/each}
</div>

<style>
  .node {
    padding-left: calc(var(--depth) * 0.9rem);
    border-left: 1px solid transparent;
  }
  .row {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.15rem 0;
  }
  .label { color: var(--fg); }
  .value { font-variant-numeric: tabular-nums; font-weight: 600; }
  .detail {
    font-size: 0.85rem;
    color: var(--muted);
    padding-left: 0.9rem;
  }
  .mod.dropped { text-decoration: line-through; opacity: 0.6; }
</style>
