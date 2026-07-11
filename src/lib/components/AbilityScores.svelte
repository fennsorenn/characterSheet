<script lang="ts">
  import { ABILITIES, ABILITY_NAMES, type Ability } from '../character/index.js';
  import { character, setAbilityScore, abilityOverrides, abilityScores } from '../stores/character.js';
  import { buffMode } from '../stores/ui.js';
  import NumberField from './NumberField.svelte';
  import StatValue from './StatValue.svelte';
  import BuffField from './BuffField.svelte';
  import EffectiveScore from './EffectiveScore.svelte';
  import Saves from './Saves.svelte';

  let { variant = 'full' }: { variant?: string } = $props();

  // A purely-persistent boost (ASI / feat / racial grant) shows as a plain number
  // — the character's own score — with no badge. True when there's no fleeting
  // override yet the persistent effective differs from the editable base.
  const persistentOnly = (abil: Ability): boolean =>
    !$abilityOverrides[abil] && $abilityScores[abil] !== $character.abilities[abil];
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
          {:else if persistentOnly(abil)}
            <span class="persistent" title={`Effective ${$abilityScores[abil]} (base ${$character.abilities[abil]})`}>{$abilityScores[abil]}</span>
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
            {:else if persistentOnly(abil)}
              <div class="persistent-full" title={`Effective ${$abilityScores[abil]} (base ${$character.abilities[abil]})`}>
                <span class="persistent">{$abilityScores[abil]}</span>
                <span class="base">base <NumberField value={$character.abilities[abil]} min={1} max={30} onchange={(v) => setAbilityScore(abil, v)} width="3ch" /></span>
              </div>
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
    {#if variant === 'withSaves'}
      <div class="saves-embed"><Saves /></div>
    {/if}
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

  /* Persistent (ASI/feat) score: a plain number, the character's own value. */
  .persistent { font-weight: 700; color: var(--fg); }
  .persistent-full { display: flex; flex-direction: column; align-items: center; gap: 0.05rem; }
  .persistent-full .persistent { font-size: 1.1rem; line-height: 1.1; }
  .persistent-full .base { font-size: 0.6rem; color: var(--muted); display: inline-flex; align-items: center; gap: 0.15rem; }

  .row { display: flex; flex-wrap: wrap; gap: 0.75rem; }
  .ab { display: flex; align-items: center; gap: 0.3rem; }
  .ab .name { font-weight: 600; }
  .ab .mod { font-weight: 700; }

  /* Saving throws folded into the same cell: drop the nested block's frame so it
     reads as one section, and separate it with a rule. */
  .saves-embed { margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px solid var(--line); }
  .saves-embed :global(.block) { border: none; border-radius: 0; padding: 0; }

  /* Reflow to 3 wide when the cell itself is narrow, not just the viewport. */
  @container cell (max-width: 340px) {
    .grid { grid-template-columns: repeat(3, 1fr); }
  }
  @media (max-width: 520px) {
    .grid { grid-template-columns: repeat(3, 1fr); }
  }
</style>
