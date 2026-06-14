<script lang="ts">
  import { SKILLS, SKILL_ABILITY, skillNodeId } from '../character/index.js';
  import { character, cycleSkillProficiency } from '../stores/character.js';
  import StatValue from './StatValue.svelte';

  const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
</script>

<section class="block">
  <h3>Skills</h3>
  <ul>
    {#each SKILLS as skill}
      {@const level = $character.skillProficiencies[skill] ?? 'none'}
      <li>
        <button
          class="dot {level}"
          aria-label="Cycle {skill} proficiency"
          title={level}
          onclick={() => cycleSkillProficiency(skill)}
        ></button>
        <span class="name">{titleCase(skill)}</span>
        <span class="abil">{SKILL_ABILITY[skill]}</span>
        <span class="val"><StatValue node={skillNodeId(skill)} signed /></span>
      </li>
    {/each}
  </ul>
</section>

<style>
  .block { border: 1px solid var(--line); border-radius: 8px; padding: 0.75rem 1rem; }
  h3 { margin: 0 0 0.6rem; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  ul { list-style: none; margin: 0; padding: 0; columns: 2; column-gap: 1.5rem; }
  li { display: flex; align-items: center; gap: 0.5rem; padding: 0.15rem 0; break-inside: avoid; }
  .dot {
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 50%;
    border: 1.5px solid var(--muted);
    background: transparent;
    cursor: pointer;
    flex: none;
  }
  .dot.proficient { background: var(--accent); border-color: var(--accent); }
  .dot.expertise {
    background: var(--accent);
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--bg), 0 0 0 3.5px var(--accent);
  }
  .name { flex: 1; }
  .abil { font-size: 0.65rem; text-transform: uppercase; color: var(--muted); }
  .val { font-weight: 600; min-width: 2ch; text-align: right; }
  @media (max-width: 520px) { ul { columns: 1; } }
</style>
