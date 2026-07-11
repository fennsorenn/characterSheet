<script lang="ts">
  import { character, grantPool } from '../stores/character.js';
  import { setMembers, maxNumeric, memberLabel, type SetCategory, type GrantChoice } from '../character/index.js';
  import GrantChoiceEditor from './GrantChoiceEditor.svelte';

  let { variant = 'full' }: { variant?: string } = $props();

  // Class starting-proficiency choices have no feature row to live on (a class
  // isn't a single feature), so they're filled here.
  const classNames = $derived(new Set($character.classes.map((c) => c.name)));
  const classChoices = $derived($grantPool.choices.filter((c) => classNames.has(c.source)));
  const chosenCount = (c: GrantChoice) =>
    c.category === 'ability'
      ? Object.values($character.abilityChoices[c.key] ?? {}).filter((v) => v).length
      : ($character.grantChoices[c.key] ?? []).filter(Boolean).length;
  const pendingChoice = (c: GrantChoice) => Math.max(0, c.count - chosenCount(c));

  // Each set category becomes a labelled row of source-annotated chips. This is
  // a pure view over the generic grant pool — adding a new grantable stat in the
  // engine surfaces here with no extra wiring.
  const SECTIONS: { category: SetCategory; label: string }[] = [
    { category: 'resist', label: 'Resistances' },
    { category: 'immune', label: 'Immunities' },
    { category: 'conditionImmune', label: 'Condition Immunities' },
    { category: 'language', label: 'Languages' },
    { category: 'toolProf', label: 'Tools' },
    { category: 'weaponProf', label: 'Weapons' },
    { category: 'armorProf', label: 'Armor' }
  ];

  const sections = $derived(
    SECTIONS.map((s) => ({ ...s, members: setMembers($grantPool, s.category) })).filter((s) => s.members.length)
  );
  const senses = $derived(maxNumeric($grantPool, 'sense.'));
  const speeds = $derived(maxNumeric($grantPool, 'speed.'));
  const empty = $derived(sections.length === 0 && senses.length === 0 && speeds.length === 0 && classChoices.length === 0);
  const cap = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
</script>

<section class="block" data-variant={variant}>
  <h3>Traits &amp; Proficiencies</h3>
  {#if empty}
    <p class="empty">Race, background, and feats will list resistances, languages, senses, and proficiencies here.</p>
  {/if}

  {#if speeds.length || senses.length}
    <div class="row">
      <span class="k">Movement &amp; Senses</span>
      <span class="chips">
        {#each speeds as s}<span class="chip">{cap(s.name)} {s.value} ft</span>{/each}
        {#each senses as s}<span class="chip" title={s.sources.join(', ')}>{cap(s.name)} {s.value} ft</span>{/each}
      </span>
    </div>
  {/if}

  {#each sections as section}
    <div class="row">
      <span class="k">{section.label}</span>
      <span class="chips">
        {#each section.members as m}
          <span class="chip" title={`from ${m.sources.join(', ')}`}>{memberLabel(section.category, m.member)}</span>
        {/each}
      </span>
    </div>
  {/each}

  {#if classChoices.length}
    <div class="row">
      <span class="k">Proficiency Choices</span>
      <span class="chips">
        {#each classChoices as c (c.key)}
          <span class="choice" class:pending={pendingChoice(c) > 0}>
            <span class="cl">{c.label} <em>({c.source})</em></span>
            <GrantChoiceEditor choice={c} />
          </span>
        {/each}
      </span>
    </div>
  {/if}
</section>

<style>
  .block { border: 1px solid var(--line); border-radius: 8px; padding: 0.75rem 1rem; }
  h3 { margin: 0 0 0.6rem; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .empty { color: var(--muted); font-size: 0.85rem; margin: 0; }
  .row { display: flex; flex-wrap: wrap; gap: 0.3rem 0.6rem; align-items: baseline; padding: 0.22rem 0; border-bottom: 1px solid var(--line); }
  .row:last-child { border-bottom: none; }
  .k { font-size: 0.68rem; text-transform: uppercase; color: var(--muted); min-width: 8.5rem; flex: none; }
  .chips { display: flex; flex-wrap: wrap; gap: 0.3rem; min-width: 0; }
  .chip { font-size: 0.75rem; padding: 0.05rem 0.45rem; border: 1px solid var(--line); border-radius: 999px; background: color-mix(in srgb, var(--accent) 8%, transparent); }
  .choice { display: inline-flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
  .choice.pending .cl { color: var(--accent); font-weight: 600; }
  .cl { font-size: 0.74rem; }
  .cl em { color: var(--muted); font-style: normal; }
</style>
