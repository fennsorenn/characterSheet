<script lang="ts">
  import { catalogState } from '../stores/catalog.js';
  import { character } from '../stores/character.js';
  import { printOpen, openPrint } from '../stores/print.js';
  import { browseOpen } from '../stores/browse.js';
  import { diceOpen } from '../stores/dice.js';
  import { navigate } from '../stores/router.js';
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
  import DiceRoller from './DiceRoller.svelte';
  import Icon from './Icon.svelte';
  import UiIcon from './UiIcon.svelte';

  // Where "← Back" returns: the owning overview.
  let { backTo = '/local' }: { backTo?: string } = $props();
  let showData = $state(false);
</script>

<main class="app-root">
  <header class="top">
    <div class="lead">
      <button class="back" onclick={() => navigate(backTo)} title="Back to characters">←</button>
      <h1>{$character.name}</h1>
    </div>
    <div class="actions">
      <button class="data-toggle" title="Dice roller" onclick={() => diceOpen.update((o) => !o)}><Icon name="dice" /> Dice</button>
      <button class="data-toggle" onclick={openPrint}>Print / PDF</button>
      <button class="data-toggle" onclick={() => (showData = !showData)}>
        {#if $catalogState.catalog}Data <UiIcon name="check" size="0.85em" />{:else}Load data{/if}
      </button>
    </div>
  </header>

  {#if showData || !$catalogState.catalog}
    <DataImport />
    <hr />
  {/if}

  {#if $catalogState.catalog}
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
<DiceRoller />

<style>
  main { max-width: 2400px; margin: 0 auto; padding: 1.25rem clamp(1rem, 2.5vw, 2.5rem); }
  .top { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
  .lead { display: flex; align-items: baseline; gap: 0.6rem; }
  .back { font: inherit; font-size: 1.1rem; border: 1px solid var(--line); background: var(--bg); color: var(--fg); border-radius: 6px; padding: 0.1rem 0.5rem; cursor: pointer; }
  .actions { display: flex; gap: 0.5rem; }
  h1 { color: var(--accent); margin: 0; }
  .data-toggle { padding: 0.35rem 0.7rem; border: 1px solid var(--line); background: var(--bg); color: var(--fg); border-radius: 6px; cursor: pointer; }
  hr { border: none; border-top: 1px solid var(--line); margin: 1.5rem 0; }
</style>
