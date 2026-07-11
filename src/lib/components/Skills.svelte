<script lang="ts">
  import { SKILLS, SKILL_ABILITY, skillNodeId, setMembers, type ProficiencyLevel, type Skill } from '../character/index.js';
  import { character, grantPool, cycleSkillProficiency } from '../stores/character.js';
  import StatValue from './StatValue.svelte';

  let { variant = 'full' }: { variant?: string } = $props();
  const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

  // Feature-granted skill proficiency / expertise, keyed to their sources.
  const grantedProf = $derived(new Map(setMembers($grantPool, 'skillProf').map((m) => [m.member.toLowerCase(), m.sources])));
  const grantedExp = $derived(new Map(setMembers($grantPool, 'expertise').map((m) => [m.member.toLowerCase(), m.sources])));

  // Effective tier: the higher of the manual toggle and any grant.
  const RANK: Record<ProficiencyLevel, number> = { none: 0, half: 1, proficient: 2, expertise: 3 };
  function effective(skill: Skill): { level: ProficiencyLevel; sources: string[] } {
    let level = ($character.skillProficiencies[skill] ?? 'none') as ProficiencyLevel;
    const sources: string[] = [];
    if (grantedProf.has(skill) && RANK[level] < RANK.proficient) { level = 'proficient'; sources.push(...grantedProf.get(skill)!); }
    if (grantedExp.has(skill)) { level = 'expertise'; sources.push(...grantedExp.get(skill)!); }
    return { level, sources };
  }

  // Compact variant lists only skills the character is trained in (incl. granted).
  const shown = $derived(
    variant === 'compact' ? SKILLS.filter((s) => effective(s).level !== 'none') : SKILLS
  );
</script>

<section class="block" data-variant={variant}>
  <h3>Skills</h3>
  {#if shown.length === 0}
    <p class="empty">No proficient skills yet.</p>
  {/if}
  <ul>
    {#each shown as skill}
      {@const eff = effective(skill)}
      <li>
        <button
          class="dot {eff.level}"
          aria-label="Cycle {skill} proficiency"
          title={eff.sources.length ? `${eff.level} (granted by ${eff.sources.join(', ')})` : eff.level}
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
  .empty { color: var(--muted); font-size: 0.85rem; margin: 0; }
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
  .name { flex: 1; min-width: 0; }
  .abil { font-size: 0.65rem; text-transform: uppercase; color: var(--muted); }
  .val { font-weight: 600; min-width: 2ch; text-align: right; }
  /* Collapse to a single column when the cell is narrow (not just the viewport),
     so a narrow-width Skills block never crams two columns into a thin cell. */
  @container cell (max-width: 360px) { ul { columns: 1; } }
  @media (max-width: 520px) { ul { columns: 1; } }
</style>
