<script lang="ts">
  import { canEditBuild } from '../stores/mode.js';
  import { SKILLS, SKILL_ABILITY, skillNodeId, setMembers, type ProficiencyLevel, type Skill } from '../character/index.js';
  import {
    character,
    grantPool,
    cycleSkillProficiency,
    addCustomSkill,
    updateCustomSkill,
    removeCustomSkill,
    cycleCustomSkillProficiency
  } from '../stores/character.js';
  import { ABILITIES, ABILITY_NAMES, customSkillNode } from '../character/index.js';
  import StatValue from './StatValue.svelte';
  import Reminders from './Reminders.svelte';
  import { anchors } from '../character/index.js';

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

  // The player's own skills sit in the same list, under the same rules: a
  // homebrew skill or a tool used like one is still a skill.
  const customs = $derived(
    (variant === 'compact'
      ? ($character.customSkills ?? []).filter((s) => s.proficiency !== 'none')
      : ($character.customSkills ?? []))
  );
  let newSkill = $state('');
  function addSkill(e: Event) {
    e.preventDefault();
    addCustomSkill(newSkill);
    newSkill = '';
  }
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
        <div class="row">
        <button
          class="dot {eff.level}"
          disabled={!$canEditBuild}
          aria-label="Cycle {skill} proficiency"
          title={eff.sources.length ? `${eff.level} (granted by ${eff.sources.join(', ')})` : eff.level}
          onclick={() => cycleSkillProficiency(skill)}
        ></button>
        <span class="name">{titleCase(skill)}</span>
        <span class="abil">{SKILL_ABILITY[skill]}</span>
        <span class="val"><StatValue node={skillNodeId(skill)} signed /></span>
        </div>
        <Reminders anchor={anchors.skill(skill)} />
      </li>
    {/each}
    {#each customs as skill (skill.id)}
      <li>
        <div class="row">
          <button
            class="dot {skill.proficiency}"
            disabled={!$canEditBuild}
            aria-label="Cycle {skill.name} proficiency"
            title={skill.proficiency}
            onclick={() => cycleCustomSkillProficiency(skill.id)}
          ></button>
          <span class="name">{skill.name}</span>
          {#if $canEditBuild}
            <select
              class="abil pick"
              aria-label="{skill.name} ability"
              value={skill.ability}
              onchange={(e) => updateCustomSkill(skill.id, { ability: (e.target as HTMLSelectElement).value as typeof skill.ability })}
            >
              {#each ABILITIES as a}<option value={a}>{ABILITY_NAMES[a].slice(0, 3)}</option>{/each}
            </select>
          {:else}
            <span class="abil">{skill.ability}</span>
          {/if}
          <span class="val"><StatValue node={customSkillNode(skill.id)} signed /></span>
          {#if $canEditBuild}
            <button class="rm" aria-label="Remove {skill.name}" onclick={() => removeCustomSkill(skill.id)}>×</button>
          {/if}
        </div>
        <Reminders anchor={anchors.skill(skill.name)} />
      </li>
    {/each}
  </ul>
  {#if $canEditBuild}
    <form class="quickadd" onsubmit={addSkill}>
      <input placeholder="Add a skill…" aria-label="New skill name" bind:value={newSkill} />
      <button type="submit" disabled={!newSkill.trim()}>+</button>
    </form>
  {/if}
</section>

<style>
  .block { border: 1px solid var(--line); border-radius: 8px; padding: 0.75rem 1rem; }
  h3 { margin: 0 0 0.6rem; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .empty { color: var(--muted); font-size: 0.85rem; margin: 0; }
  ul { list-style: none; margin: 0; padding: 0; columns: 2; column-gap: 1.5rem; }
  li { padding: 0.15rem 0; break-inside: avoid; }
  .row { display: flex; align-items: center; gap: 0.5rem; }
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
  .pick { font: inherit; font-size: 0.7rem; padding: 0 0.1rem; border: 1px solid var(--line); border-radius: 4px; background: var(--bg); color: var(--muted); }
  .rm { font: inherit; font-size: 0.85rem; line-height: 1; padding: 0 0.2rem; border: none; background: none; color: var(--muted); cursor: pointer; }
  .rm:hover { color: #d2645a; }
  /* The list is two columns; the add bar spans them. */
  .quickadd { display: flex; gap: 0.35rem; margin-top: 0.5rem; }
  .quickadd input { flex: 1; min-width: 0; font: inherit; font-size: 0.8rem; padding: 0.2rem 0.4rem; border: 1px solid var(--line); border-radius: 6px; background: var(--bg); color: var(--fg); }
  .quickadd button { font: inherit; padding: 0.1rem 0.6rem; border: 1px solid var(--line); border-radius: 6px; background: var(--bg); color: var(--fg); cursor: pointer; }
  .quickadd button:disabled { opacity: 0.4; cursor: default; }
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
