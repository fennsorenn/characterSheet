<script lang="ts">
  import { ABILITIES, ABILITY_NAMES, setMembers } from '../character/index.js';
  import { character, grantPool, toggleSaveProficiency } from '../stores/character.js';
  import StatValue from './StatValue.svelte';

  let { variant = 'full' }: { variant?: string } = $props();
  const proficient = $derived(new Set($character.saveProficiencies));
  // Feature-granted save proficiencies (Resilient, …), keyed to their sources.
  const granted = $derived(new Map(setMembers($grantPool, 'saveProf').map((m) => [m.member.toLowerCase(), m.sources])));
</script>

<section class="block" data-variant={variant}>
  <h3>Saving Throws</h3>
  <ul>
    {#each ABILITIES as abil}
      {@const grantedBy = granted.get(abil)}
      <li>
        <button
          class="dot"
          class:on={proficient.has(abil) || !!grantedBy}
          class:granted={!!grantedBy && !proficient.has(abil)}
          aria-label="Toggle {ABILITY_NAMES[abil]} save proficiency"
          title={grantedBy ? `Granted by ${grantedBy.join(', ')}` : undefined}
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
  /* Granted (not manually toggled) reads as a hollow accent ring. */
  .dot.granted { background: transparent; box-shadow: inset 0 0 0 2px var(--bg), 0 0 0 1.5px var(--accent); }
  .name { flex: 1; }
  .val { font-weight: 600; }
</style>
