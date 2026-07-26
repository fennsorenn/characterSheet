<script lang="ts">
  import { canEditBuild } from '../stores/mode.js';
  import { character, setAcBase, setClassLevel, acOverride, castingAbility } from '../stores/character.js';
  import { totalLevel } from '../character/index.js';
  import NumberField from './NumberField.svelte';
  import StatValue from './StatValue.svelte';
  import Icon from './Icon.svelte';
  import { defaultOptions } from '../layout/blocks.js';

  let { variant = 'full', options = {} }: { variant?: string; options?: Record<string, boolean> } =
    $props();
  // Which stats appear is per-instance, so two of these blocks with different
  // options cover what would otherwise need several block types — the spell pair
  // on its own is the "spellcasting" block.
  const on = $derived({ ...defaultOptions('defenses', variant), ...options });
  const level = $derived(totalLevel($character));
</script>

<section class="block" data-variant={variant}>
  <h3>Defenses &amp; Core</h3>
  <div class="row">
    {#if on.ac}
      <div class="stat big">
        <span class="k">AC</span>
        <span class="v" data-volatile="occasional">
          <StatValue node="ac" />
          {#if $acOverride}
            <span
              class="ac-badge"
              class:buff={$acOverride.kind === 'buff'}
              aria-label={$acOverride.source}
              title={`${$acOverride.source} (${$acOverride.delta >= 0 ? '+' : ''}${$acOverride.delta})`}
            ><Icon name={$acOverride.icon} /></span>
          {/if}
        </span>
        {#if on.baseAc}
          <span class="sub">base <NumberField label="Base armour class" value={$character.acBase} min={0} max={30} locked={!$canEditBuild} onchange={setAcBase} /></span>
        {/if}
      </div>
    {/if}
    {#if on.initiative}
      <div class="stat">
        <span class="k">Initiative</span>
        <span class="v" data-volatile="occasional"><StatValue node="initiative" signed /></span>
      </div>
    {/if}
    {#if on.profBonus}
      <div class="stat">
        <span class="k">Prof. Bonus</span>
        <span class="v" data-volatile="occasional"><StatValue node="prof.bonus" signed /></span>
      </div>
    {/if}
    {#if on.passivePerception}
      <div class="stat">
        <span class="k">Passive Perc.</span>
        <span class="v" data-volatile="occasional"><StatValue node="passive.perception" /></span>
      </div>
    {/if}
    {#if on.passiveInvestigation}
      <div class="stat">
        <span class="k">Passive Inv.</span>
        <span class="v" data-volatile="occasional"><StatValue node="passive.investigation" /></span>
      </div>
    {/if}
    {#if on.passiveInsight}
      <div class="stat">
        <span class="k">Passive Ins.</span>
        <span class="v" data-volatile="occasional"><StatValue node="passive.insight" /></span>
      </div>
    {/if}
    {#if on.level}
      <div class="stat">
        <span class="k">Level</span>
        <span class="v" data-volatile="occasional">
          <NumberField label="Class level" value={level} min={1} max={20} locked={!$canEditBuild} onchange={(v) => setClassLevel(0, v)} />
        </span>
      </div>
    {/if}
    <!-- The spell pair still needs a casting ability to mean anything, so the
         option decides whether to offer it, not whether it exists. The ability
         comes from the class — a cleric's document never says "wisdom". -->
    {#if $castingAbility && on.spellDc}
      <div class="stat">
        <span class="k">Spell DC</span>
        <span class="v" data-volatile="occasional"><StatValue node="spell.dc" /></span>
      </div>
    {/if}
    {#if $castingAbility && on.spellAttack}
      <div class="stat">
        <span class="k">Spell Atk</span>
        <span class="v" data-volatile="occasional"><StatValue node="spell.attack" signed /></span>
      </div>
    {/if}
  </div>
</section>

<style>
  .block { border: 1px solid var(--line); border-radius: 8px; padding: 0.75rem 1rem; }
  h3 { margin: 0 0 0.6rem; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .row { display: flex; flex-wrap: wrap; gap: 0.75rem; }
  .stat {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.4rem 0.7rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 4.5rem;
  }
  .stat.big .v { font-size: 1.8rem; display: inline-flex; align-items: center; gap: 0.25rem; }
  /* Grey badge for shield/equipment AC; green tint for a temporary buff. */
  .ac-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 4px;
    background: color-mix(in srgb, var(--muted) 18%, transparent);
    color: var(--muted);
    cursor: help;
  }
  .ac-badge.buff { background: color-mix(in srgb, #3fa45b 18%, transparent); color: #3fa45b; }
  .ac-badge :global(.icon) { width: 0.8rem; height: 0.8rem; }
  .k { font-size: 0.65rem; text-transform: uppercase; color: var(--muted); }
  .v { font-size: 1.3rem; font-weight: 700; }
  .sub { font-size: 0.7rem; color: var(--muted); }
</style>
