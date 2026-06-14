<script lang="ts">
  import { graph } from '../stores/character.js';
  import { explainTarget, closeExplain } from '../stores/ui.js';
  import ExplainNode from './ExplainNode.svelte';

  // The "click a number to see how it's built" modal. Reads the active target
  // and renders the live explanation tree from the calc graph.
  const explanation = $derived(
    $explainTarget && $graph.has($explainTarget.id)
      ? $graph.explain($explainTarget.id)
      : null
  );
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && closeExplain()} />

{#if $explainTarget && explanation}
  <div
    class="backdrop"
    role="presentation"
    onclick={(e) => e.target === e.currentTarget && closeExplain()}
  >
    <div class="modal" role="dialog" tabindex="-1" aria-modal="true">
      <header>
        <h2>{$explainTarget.label} = {explanation.value}</h2>
        <button class="close" aria-label="Close" onclick={closeExplain}>×</button>
      </header>
      <p class="hint">How this value is calculated. Edit the underlying scores on the sheet to see it update.</p>
      <div class="tree">
        <ExplainNode node={explanation} />
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    z-index: 50;
  }
  .modal {
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 10px;
    max-width: 420px;
    width: 100%;
    max-height: 80vh;
    overflow: auto;
    padding: 1rem 1.25rem 1.25rem;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
  }
  header { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; }
  h2 { margin: 0; font-size: 1.1rem; color: var(--accent); }
  .close {
    background: none;
    border: none;
    font-size: 1.5rem;
    line-height: 1;
    color: var(--muted);
    cursor: pointer;
  }
  .hint { color: var(--muted); font-size: 0.85rem; margin: 0.25rem 0 0.75rem; }
</style>
