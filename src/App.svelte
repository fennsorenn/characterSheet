<script lang="ts">
  import { onMount } from 'svelte';
  import { restoreCached, catalogState } from './lib/stores/catalog.js';
  import DataImport from './lib/components/DataImport.svelte';
  import QuickSearch from './lib/components/QuickSearch.svelte';
  import CharacterSheet from './lib/components/CharacterSheet.svelte';

  const version = '0.0.0';
  let showData = $state(false);

  // Restore a previously supplied dataset from IndexedDB on startup.
  onMount(restoreCached);
</script>

<main>
  <header class="top">
    <h1>Character Sheet <small>v{version}</small></h1>
    <button class="data-toggle" onclick={() => (showData = !showData)}>
      {$catalogState.catalog ? 'Data ✓' : 'Load data'}
    </button>
  </header>

  {#if showData || !$catalogState.catalog}
    <DataImport />
    <hr />
  {/if}

  <!-- Quick import stays available whenever data is loaded. -->
  {#if $catalogState.catalog}
    <QuickSearch />
  {/if}

  <CharacterSheet />
</main>

<style>
  main { max-width: 960px; margin: 0 auto; padding: 1.5rem 1rem; }
  .top { display: flex; align-items: baseline; justify-content: space-between; }
  h1 { color: var(--accent); margin: 0; }
  small { color: var(--muted); font-weight: 400; font-size: 0.6em; }
  .data-toggle {
    padding: 0.35rem 0.7rem;
    border: 1px solid var(--line);
    background: var(--bg);
    color: var(--fg);
    border-radius: 6px;
    cursor: pointer;
  }
  hr { border: none; border-top: 1px solid var(--line); margin: 1.5rem 0; }
</style>
