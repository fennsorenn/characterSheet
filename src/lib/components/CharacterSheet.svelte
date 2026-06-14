<script lang="ts">
  import { character, setName } from '../stores/character.js';
  import AbilityScores from './AbilityScores.svelte';
  import Defenses from './Defenses.svelte';
  import Saves from './Saves.svelte';
  import Skills from './Skills.svelte';
  import Inventory from './Inventory.svelte';
  import SpellList from './SpellList.svelte';
  import ExplainPopover from './ExplainPopover.svelte';
</script>

<div class="sheet">
  <input
    class="char-name"
    value={$character.name}
    aria-label="Character name"
    oninput={(e) => setName((e.target as HTMLInputElement).value)}
  />
  <p class="tip">Every number with a dotted underline is computed — click it to see and trace the calculation.</p>

  <div class="layout">
    <div class="col">
      <AbilityScores />
      <Defenses />
      <Saves />
    </div>
    <div class="col">
      <Skills />
    </div>
    <div class="col">
      <Inventory />
    </div>
    <div class="col">
      <SpellList />
    </div>
  </div>
</div>

<ExplainPopover />

<style>
  .char-name {
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--fg);
    background: transparent;
    border: none;
    border-bottom: 1px solid transparent;
    width: 100%;
    padding: 0.1rem 0;
  }
  .char-name:hover { border-bottom-color: var(--line); }
  .char-name:focus { outline: none; border-bottom-color: var(--accent); }
  .tip { color: var(--muted); font-size: 0.85rem; margin: 0.25rem 0 1rem; }
  .layout { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .col { display: flex; flex-direction: column; gap: 1rem; }
  @media (max-width: 720px) {
    .layout { grid-template-columns: 1fr; }
  }
</style>
