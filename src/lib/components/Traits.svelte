<script lang="ts">
  import { canEditBuild } from '../stores/mode.js';
  import { character, grantPool, addCustomGrant, removeCustomGrant } from '../stores/character.js';
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

  // Anything the player added by hand can be taken away again; everything else
  // is a consequence of the build and has to be edited at its source.
  const customs = $derived($character.customGrants ?? []);
  const customSet = $derived(
    new Map(
      customs
        .filter((g) => g.kind === 'set')
        .map((g) => [`${g.category}|${g.member.trim().toLowerCase()}`, g.id])
    )
  );
  const customDistance = $derived(
    new Map(
      customs
        .filter((g) => g.kind !== 'set')
        .map((g) => [`${g.kind}|${g.name.trim().toLowerCase()}`, g.id])
    )
  );
  /**
   * The ✕ appears whenever *the player* added something for this line, whoever
   * else grants it too. Keying off the winning source instead would strand a
   * hand-added swim speed the moment a race granted a better one: the chip would
   * show the race's number and the player's entry would be invisible and
   * unremovable.
   */
  const ownId = (key: string, map: Map<string, string>) => map.get(key);

  // One add row for the whole block: pick what kind of thing, then say it.
  const KINDS: { key: string; label: string; distance?: boolean }[] = [
    { key: 'speed', label: 'Movement', distance: true },
    { key: 'sense', label: 'Sense', distance: true },
    { key: 'language', label: 'Language' },
    { key: 'toolProf', label: 'Tool' },
    { key: 'weaponProf', label: 'Weapon' },
    { key: 'armorProf', label: 'Armor' },
    { key: 'resist', label: 'Resistance' },
    { key: 'immune', label: 'Immunity' },
    { key: 'conditionImmune', label: 'Condition immunity' }
  ];
  let kind = $state('speed');
  let text = $state('');
  let feet = $state(30);
  const kindMeta = $derived(KINDS.find((k) => k.key === kind) ?? KINDS[0]);

  function add(e: Event) {
    e.preventDefault();
    const name = text.trim();
    if (!name) return;
    if (kindMeta.distance) addCustomGrant({ kind: kind as 'speed' | 'sense', name, feet });
    else addCustomGrant({ kind: 'set', category: kind, member: name });
    text = '';
  }
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
        {#each speeds as s}
          {@const mine = ownId(`speed|${s.name}`, customDistance)}
          <span class="chip" title={s.sources.join(', ')}>
            {cap(s.name)} {s.value} ft
            {#if mine && $canEditBuild}<button class="x" aria-label="Remove {s.name} speed" onclick={() => removeCustomGrant(mine)}>×</button>{/if}
          </span>
        {/each}
        {#each senses as s}
          {@const mine = ownId(`sense|${s.name}`, customDistance)}
          <span class="chip" title={s.sources.join(', ')}>
            {cap(s.name)} {s.value} ft
            {#if mine && $canEditBuild}<button class="x" aria-label="Remove {s.name}" onclick={() => removeCustomGrant(mine)}>×</button>{/if}
          </span>
        {/each}
      </span>
    </div>
  {/if}

  {#each sections as section}
    <div class="row">
      <span class="k">{section.label}</span>
      <span class="chips">
        {#each section.members as m}
          {@const mine = ownId(`${section.category}|${m.member.toLowerCase()}`, customSet)}
          <span class="chip" title={`from ${m.sources.join(', ')}`}>
            {memberLabel(section.category, m.member)}
            {#if mine && $canEditBuild}<button class="x" aria-label="Remove {m.member}" onclick={() => removeCustomGrant(mine)}>×</button>{/if}
          </span>
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

  {#if $canEditBuild}
    <form class="add" onsubmit={add}>
      <select aria-label="What to add" bind:value={kind}>
        {#each KINDS as k}<option value={k.key}>{k.label}</option>{/each}
      </select>
      <input
        aria-label="Name"
        placeholder={kindMeta.distance ? (kind === 'speed' ? 'fly, swim, climb…' : 'darkvision, tremorsense…') : 'name…'}
        bind:value={text}
      />
      {#if kindMeta.distance}
        <input class="ft" type="number" min="0" max="999" step="5" aria-label="Distance in feet" bind:value={feet} />
        <span class="unit">ft</span>
      {/if}
      <button type="submit" disabled={!text.trim()}>Add</button>
    </form>
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
  .x { font: inherit; font-size: 0.7rem; line-height: 1; padding: 0 0 0 0.15rem; border: none; background: none; color: var(--muted); cursor: pointer; }
  .x:hover { color: #d2645a; }
  .add { display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem; margin-top: 0.6rem; }
  .add select, .add input, .add button { font: inherit; font-size: 0.78rem; padding: 0.2rem 0.4rem; border: 1px solid var(--line); border-radius: 6px; background: var(--bg); color: var(--fg); }
  .add input { flex: 1; min-width: 6rem; }
  .add .ft { flex: none; width: 4rem; }
  .add .unit { font-size: 0.7rem; color: var(--muted); }
  .add button { cursor: pointer; }
  .add button:disabled { opacity: 0.4; cursor: default; }
</style>
