<script lang="ts">
  import { ABILITIES, ABILITY_NAMES } from '../character/index.js';
  import { character, setAbilityScore, abilityOverrides } from '../stores/character.js';
  import { buffMode } from '../stores/ui.js';
  import NumberField from './NumberField.svelte';
  import StatValue from './StatValue.svelte';
  import BuffField from './BuffField.svelte';
  import EffectiveScore from './EffectiveScore.svelte';

  let { variant = 'full' }: { variant?: string } = $props();
</script>

<section class="block" data-variant={variant}>
  <h3>Ability Scores</h3>
  {#if variant === 'compact'}
    <div class="row">
      {#each ABILITIES as abil}
        <div class="ab" data-volatile="occasional">
          <span class="name">{ABILITY_NAMES[abil].slice(0, 3)}</span>
          <span class="mod"><StatValue node={`ability.${abil}.mod`} signed adjustable={false} /></span>
          {#if $buffMode}
            <BuffField node={`ability.${abil}.score`} />
          {:else if $abilityOverrides[abil]}
            <EffectiveScore {abil} override={$abilityOverrides[abil]} />
          {:else}
            <NumberField
              value={$character.abilities[abil]}
              min={1}
              max={30}
              onchange={(v) => setAbilityScore(abil, v)}
            />
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <div class="grid">
      {#each ABILITIES as abil}
        <div class="ability">
          <div class="name">{ABILITY_NAMES[abil].slice(0, 3)}</div>
          <div class="modbig" data-volatile="occasional"><StatValue node={`ability.${abil}.mod`} signed adjustable={false} /></div>
          <div class="score" data-volatile="occasional">
            {#if $buffMode}
              <BuffField node={`ability.${abil}.score`} />
            {:else if $abilityOverrides[abil]}
              <EffectiveScore {abil} override={$abilityOverrides[abil]} />
            {:else}
              <NumberField
                value={$character.abilities[abil]}
                min={1}
                max={30}
                onchange={(v) => setAbilityScore(abil, v)}
              />
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .block { border: 1px solid var(--line); border-radius: 8px; padding: 0.75rem 1rem; }
  h3 { margin: 0 0 0.6rem; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }

  .grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.5rem; }
  .ability { border: 1px solid var(--line); border-radius: 8px; text-align: center; padding: 0.4rem 0.2rem; }
  .name { font-size: 0.7rem; text-transform: uppercase; color: var(--muted); }
  .modbig { font-size: 1.4rem; font-weight: 700; margin: 0.1rem 0; }
  .score { border-top: 1px solid var(--line); padding-top: 0.2rem; }

  .row { display: flex; flex-wrap: wrap; gap: 0.75rem; }
  .ab { display: flex; align-items: center; gap: 0.3rem; }
  .ab .name { font-weight: 600; }
  .ab .mod { font-weight: 700; }

  @media (max-width: 520px) {
    .grid { grid-template-columns: repeat(3, 1fr); }
  }
</style>
