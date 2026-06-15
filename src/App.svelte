<script lang="ts">
  import { onMount } from 'svelte';
  import { restoreCached, catalogState } from './lib/stores/catalog.js';
  import { printOpen, openPrint } from './lib/stores/print.js';
  import { browseOpen } from './lib/stores/browse.js';
  import DataImport from './lib/components/DataImport.svelte';
  import QuickSearch from './lib/components/QuickSearch.svelte';
  import CharacterSheet from './lib/components/CharacterSheet.svelte';
  import PrintView from './lib/components/print/PrintView.svelte';
  import BrowseImport from './lib/components/import/BrowseImport.svelte';
  import SpellPicker from './lib/components/SpellPicker.svelte';

  const version = '0.0.0';
  let showData = $state(false);

  // Restore a previously supplied dataset from IndexedDB on startup.
  onMount(restoreCached);
</script>

<main class="app-root">
  <header class="top">
    <h1>Character Sheet <small>v{version}</small></h1>
    <div class="actions">
      <button class="data-toggle" onclick={openPrint}>Print / PDF</button>
      <button class="data-toggle" onclick={() => (showData = !showData)}>
        {$catalogState.catalog ? 'Data ✓' : 'Load data'}
      </button>
    </div>
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

{#if $printOpen}
  <PrintView />
{/if}

{#if $browseOpen && $catalogState.catalog}
  <BrowseImport />
{/if}

<SpellPicker />

<style>
  /* Use the full viewport width; the grid handles internal columns. A generous
     cap keeps line lengths sane on very large monitors without wasting space. */
  main { max-width: 2400px; margin: 0 auto; padding: 1.25rem clamp(1rem, 2.5vw, 2.5rem); }
  .top { display: flex; align-items: baseline; justify-content: space-between; }
  .actions { display: flex; gap: 0.5rem; }
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
