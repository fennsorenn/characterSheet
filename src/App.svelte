<script lang="ts">
  import { onMount } from 'svelte';
  import { restoreCached } from './lib/stores/catalog.js';
  import DataImport from './lib/components/DataImport.svelte';
  import QuickSearch from './lib/components/QuickSearch.svelte';

  const version = '0.0.0';

  // Restore a previously supplied dataset from IndexedDB on startup.
  onMount(restoreCached);
</script>

<main>
  <h1>Character Sheet <small>v{version}</small></h1>
  <DataImport />
  <QuickSearch />
</main>

<style>
  main { max-width: 900px; margin: 0 auto; padding: 2rem 1rem; }
  h1 { color: var(--accent); }
  small { color: var(--muted); font-weight: 400; font-size: 0.6em; }
</style>
