<script lang="ts">
  import { canEditBuild } from '../stores/mode.js';
  import { ABILITIES, ABILITY_NAMES, type Ability } from '../character/index.js';
  import { character, setAbilityScore, abilityOverrides, abilityScores } from '../stores/character.js';
  import { buffMode } from '../stores/ui.js';
  import NumberField from './NumberField.svelte';
  import Reminders from './Reminders.svelte';
  import { anchors } from '../character/index.js';
  import StatValue from './StatValue.svelte';
  import BuffField from './BuffField.svelte';
  import EffectiveScore from './EffectiveScore.svelte';
  import SaveDot from './SaveDot.svelte';
  import Icon from './Icon.svelte';

  let { variant = 'full' }: { variant?: string } = $props();
  const withSaves = $derived(variant === 'withSaves');

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
            locked={!$canEditBuild}
              />
          {/if}
          <Reminders anchor={anchors.ability(abil)} />
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
                <span class="base">base <NumberField value={$character.abilities[abil]} min={1} max={30} onchange={(v) => setAbilityScore(abil, v)} locked={!$canEditBuild}
              /></span>
              </div>
            {:else}
              <NumberField
                value={$character.abilities[abil]}
                min={1}
                max={30}
                onchange={(v) => setAbilityScore(abil, v)}
              locked={!$canEditBuild}
              />
            {/if}
          </div>
          <Reminders anchor={anchors.ability(abil)} />
          <!-- The saving throw belongs to the ability, so it rides in the same
               box rather than repeating all six names in a list underneath. -->
          {#if withSaves}
            <div class="save" data-volatile="occasional" title="{ABILITY_NAMES[abil]} Saving Throw">
              <SaveDot {abil} />
              <span class="sicon" role="img" aria-label="{ABILITY_NAMES[abil]} saving throw">
                <Icon name="save" />
              </span>
              <span class="sval"><StatValue node={`save.${abil}`} signed /></span>
            </div>
            <Reminders anchor={anchors.save(abil)} />
          {/if}
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

  /* Persistent (ASI/feat) score: a plain number, the character's own value. */
  .persistent { font-weight: 700; color: var(--fg); }
  .persistent-full { display: flex; flex-direction: column; align-items: center; gap: 0.05rem; }
  .persistent-full .persistent { font-size: 1.1rem; line-height: 1.1; }
  .persistent-full .base { font-size: 0.6rem; color: var(--muted); display: inline-flex; align-items: center; gap: 0.15rem; }

  .row { display: flex; flex-wrap: wrap; gap: 0.75rem; }
  .ab { display: flex; align-items: center; gap: 0.3rem; }
  .ab .name { font-weight: 600; }
  .ab .mod { font-weight: 700; }

  /* The saving throw, folded into its ability's box: a rule separates it from
     the score above, and the label stays small so the mod remains the headline. */
  .save {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    margin-top: 0.25rem;
    padding-top: 0.2rem;
    border-top: 1px solid var(--line);
    cursor: help;
  }
  .sicon { display: inline-flex; color: var(--muted); }
  .sicon :global(.icon) { width: 1rem; height: 1rem; }
  .sval { font-weight: 600; font-size: 0.85rem; }

  /* Reflow to 3 wide when the cell itself is narrow, not just the viewport. */
  @container cell (max-width: 340px) {
    .grid { grid-template-columns: repeat(3, 1fr); }
  }
  @media (max-width: 520px) {
    .grid { grid-template-columns: repeat(3, 1fr); }
  }
</style>
