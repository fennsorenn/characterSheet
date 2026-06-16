<script lang="ts">
  import { character, setAcBase, setClassLevel, acOverride } from '../stores/character.js';
  import { totalLevel } from '../character/index.js';
  import NumberField from './NumberField.svelte';
  import StatValue from './StatValue.svelte';
  import Icon from './Icon.svelte';

  let { variant = 'full' }: { variant?: string } = $props();
  const full = $derived(variant !== 'compact');
  const level = $derived(totalLevel($character));
</script>

<section class="block" data-variant={variant}>
  <h3>Defenses &amp; Core</h3>
  <div class="row">
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
      {#if full}
        <span class="sub">base <NumberField value={$character.acBase} min={0} max={30} onchange={setAcBase} /></span>
      {/if}
    </div>
    <div class="stat">
      <span class="k">Initiative</span>
      <span class="v" data-volatile="occasional"><StatValue node="initiative" signed /></span>
    </div>
    <div class="stat">
      <span class="k">Prof. Bonus</span>
      <span class="v" data-volatile="occasional"><StatValue node="prof.bonus" signed /></span>
    </div>
    {#if full}
      <div class="stat">
        <span class="k">Passive Perc.</span>
        <span class="v" data-volatile="occasional"><StatValue node="passive.perception" /></span>
      </div>
      <div class="stat">
        <span class="k">Level</span>
        <span class="v" data-volatile="occasional">
          <NumberField value={level} min={1} max={20} onchange={(v) => setClassLevel(0, v)} />
        </span>
      </div>
      {#if $character.spellcasting}
        <div class="stat">
          <span class="k">Spell DC</span>
          <span class="v" data-volatile="occasional"><StatValue node="spell.dc" /></span>
        </div>
        <div class="stat">
          <span class="k">Spell Atk</span>
          <span class="v" data-volatile="occasional"><StatValue node="spell.attack" signed /></span>
        </div>
      {/if}
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
