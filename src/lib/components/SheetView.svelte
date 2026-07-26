<script lang="ts">
  import { catalogState } from '../stores/catalog.js';
  import { character } from '../stores/character.js';
  import { printOpen } from '../stores/print.js';
  import { browseOpen } from '../stores/browse.js';
  import { navigate } from '../stores/router.js';
  import { dataPanelOpen } from '../stores/ui.js';
  import { canEditBuild } from '../stores/mode.js';
  import { screenCategory } from '../stores/screen.js';
  import DataImport from './DataImport.svelte';
  import QuickSearch from './QuickSearch.svelte';
  import CharacterSheet from './CharacterSheet.svelte';
  import PrintView from './print/PrintView.svelte';
  import BrowseImport from './import/BrowseImport.svelte';
  import SpellPicker from './SpellPicker.svelte';
  import OptionalFeaturePicker from './OptionalFeaturePicker.svelte';
  import FeatPicker from './FeatPicker.svelte';
  import VariantPicker from './VariantPicker.svelte';
  import DetailWindow from './DetailWindow.svelte';
  import ReminderWindow from './ReminderWindow.svelte';
  import CustomEntryWindow from './CustomEntryWindow.svelte';
  import Dock from './Dock.svelte';
  import DiceRoller from './DiceRoller.svelte';

  // Where "← Back" returns: the owning overview.
  let { backTo = '/local' }: { backTo?: string } = $props();

  // The dock reserves an edge: a gutter on the side, a strip at the bottom.
  const bottomDock = $derived($screenCategory === 'mobile');
</script>

<main class="app-root" class:bottom-dock={bottomDock} class:side-dock={!bottomDock}>
  <header class="top">
    <div class="lead">
      <button class="back" onclick={() => navigate(backTo)} title="Back to characters">←</button>
      <h1>{$character.name}</h1>
    </div>
  </header>

  {#if $dataPanelOpen || !$catalogState.catalog}
    <DataImport />
    <hr />
  {/if}

  <!-- The import bar only adds things, so it goes with the rest of the
       build affordances rather than sitting there refusing input. -->
  {#if $catalogState.catalog && $canEditBuild}
    <QuickSearch />
  {/if}

  <CharacterSheet />
</main>

{#if $printOpen}<PrintView />{/if}
{#if $browseOpen && $catalogState.catalog}<BrowseImport />{/if}

<SpellPicker />
<OptionalFeaturePicker />
<FeatPicker />
<VariantPicker />
<DetailWindow />
<ReminderWindow />
<CustomEntryWindow />
<Dock {backTo} />
<DiceRoller />

<style>
  main { max-width: 2400px; margin: 0 auto; padding: 1.25rem clamp(1rem, 2.5vw, 2.5rem); }
  /* Keep the sheet clear of the dock's resting footprint, so the shut dock
     never covers content. Opening it overlays — it is transient. */
  .side-dock { padding-right: calc(clamp(1rem, 2.5vw, 2.5rem) + 3.4rem); }
  .bottom-dock { padding-bottom: 6rem; }
  .top { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
  .lead { display: flex; align-items: baseline; gap: 0.6rem; }
  .back { font: inherit; font-size: 1.1rem; border: 1px solid var(--line); background: var(--bg); color: var(--fg); border-radius: 6px; padding: 0.1rem 0.5rem; cursor: pointer; }
  h1 { color: var(--accent); margin: 0; }
  hr { border: none; border-top: 1px solid var(--line); margin: 1.5rem 0; }
</style>
