<script lang="ts">
  import { ABILITIES, ABILITY_NAMES } from '../character/index.js';
  import { character, toggleSaveProficiency } from '../stores/character.js';
  import StatValue from './StatValue.svelte';

  const proficient = $derived(new Set($character.saveProficiencies));
</script>

<section class="block">
  <h3>Saving Throws</h3>
  <ul>
    {#each ABILITIES as abil}
      <li>
        <button
          class="dot"
          class:on={proficient.has(abil)}
          aria-label="Toggle {ABILITY_NAMES[abil]} save proficiency"
          onclick={() => toggleSaveProficiency(abil)}
        ></button>
        <span class="name">{ABILITY_NAMES[abil]}</span>
        <span class="val"><StatValue node={`save.${abil}`} signed /></span>
      </li>
    {/each}
  </ul>
</section>

<style>
  .block { border: 1px solid var(--line); border-radius: 8px; padding: 0.75rem 1rem; }
  h3 { margin: 0 0 0.6rem; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  ul { list-style: none; margin: 0; padding: 0; }
  li { display: flex; align-items: center; gap: 0.55rem; padding: 0.18rem 0; }
  .dot {
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 50%;
    border: 1.5px solid var(--muted);
    background: transparent;
    cursor: pointer;
    flex: none;
  }
  .dot.on { background: var(--accent); border-color: var(--accent); }
  .name { flex: 1; }
  .val { font-weight: 600; }
</style>
