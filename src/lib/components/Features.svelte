<script lang="ts">
  import {
    character,
    setRace,
    setBackground,
    removeFeat,
    setSubclass,
    setSpellChoice,
    setFeatureOption,
    setOptionalChoice,
    setAbilityChoice,
    setFeatChoice,
    setFeatureHidden,
    addFeatureTag,
    removeFeatureTag
  } from '../stores/character.js';
  import { catalogState } from '../stores/catalog.js';
  import { openBrowse } from '../stores/browse.js';
  import { openSpellPicker } from '../stores/spellPicker.js';
  import { openOptionalPicker } from '../stores/optionalPicker.js';
  import { openFeatPicker } from '../stores/featPicker.js';
  import {
    resolveFeatures,
    featureChoices,
    featureOptionalProgressions,
    type Feature,
    type OptionalProgression
  } from '../character/index.js';
  import type { CatalogRef } from '../character/index.js';
  import { parseTaggedString, renderToHtml } from '../render/tags.js';
  import AsiEditor from './AsiEditor.svelte';

  let { variant = 'full' }: { variant?: string } = $props();

  let expanded = $state<Set<string>>(new Set());
  let hiddenGroups = $state<Set<string>>(new Set()); // source tags filtered out
  let showHidden = $state(false);

  const features = $derived<Feature[]>(
    $catalogState.catalog ? resolveFeatures($character, $catalogState.catalog) : []
  );
  const choices = $derived(
    $catalogState.catalog ? featureChoices($character, $catalogState.catalog) : { options: [], spells: [] }
  );
  const progressions = $derived<OptionalProgression[]>(
    $catalogState.catalog ? featureOptionalProgressions($character, $catalogState.catalog) : []
  );

  // --- optional-feature progressions (maneuvers, invocations, metamagic, …) ---
  const slotKey = (p: OptionalProgression, i: number) => `${p.key}|${i}`;
  const slotNoun = (p: OptionalProgression) => p.name.replace(/s$/i, '').toLowerCase();
  const progPending = (p: OptionalProgression) =>
    Array.from({ length: p.count }, (_, i) => i).filter((i) => !$character.optionalChoices[slotKey(p, i)]).length;
  const optionalEntry = (ref: CatalogRef) =>
    ($catalogState.catalog?.entries.optionalfeature ?? []).find(
      (o) => o.name.toLowerCase() === ref.name.toLowerCase()
    );
  const visibleProgs = $derived(progressions.filter((p) => groupShown(p.group)));
  const totalProgPending = $derived(progressions.reduce((n, p) => n + progPending(p), 0));

  // --- per-feature identity / hidden / tags ---
  const metaKey = (f: Feature) => `${f.name}|${f.source}`;
  const featKey = (f: Feature) => `${f.group}:${f.name}:${f.subtitle ?? ''}`;
  const autoHidden = (f: Feature) => /ability score improvement/i.test(f.name);
  const customTags = (f: Feature) => $character.featureMeta[metaKey(f)]?.tags ?? [];

  // --- ASI + pending-choice tracking ---
  const isAsi = (f: Feature) => /ability score improvement/i.test(f.name);
  const asiKey = (f: Feature) => `${f.name}|${f.source}|${f.subtitle ?? ''}`;
  const asiValue = (f: Feature) => $character.abilityChoices[asiKey(f)] ?? {};
  const featValue = (f: Feature) => $character.featChoices[asiKey(f)];
  const asiMode = (f: Feature): 'ability' | 'feat' => (featValue(f) ? 'feat' : 'ability');

  function setAsiMode(f: Feature, mode: string) {
    const key = asiKey(f);
    if (mode === 'feat') {
      setAbilityChoice(key, undefined);
      openFeatPicker({ key, label: `${f.name}: choose a feat` });
    } else {
      setFeatChoice(key, undefined);
    }
  }

  function pendingCount(f: Feature): number {
    let n = 0;
    if (isAsi(f) && Object.keys(asiValue(f)).length === 0 && !featValue(f)) n += 1;
    n += optionsFor(f).filter((o) => !$character.featureOptions[o.key]).length;
    n += spellsFor(f).filter((s) => !$character.spellChoices[s.key]).length;
    return n;
  }
  // Surface pending features even if they'd auto-hide; explicit hide still wins.
  const isHidden = (f: Feature) => {
    const explicit = $character.featureMeta[metaKey(f)]?.hidden;
    if (explicit !== undefined) return explicit;
    if (pendingCount(f) > 0) return false;
    return autoHidden(f);
  };
  const totalPending = $derived(features.reduce((n, f) => n + pendingCount(f), 0));

  const sources = $derived([...new Set(features.map((f) => f.group))]);
  const groupShown = (g: string) => !hiddenGroups.has(g);

  const visible = $derived(features.filter((f) => groupShown(f.group) && !isHidden(f)));
  const hidden = $derived(features.filter((f) => groupShown(f.group) && isHidden(f)));

  function toggleGroup(g: string) {
    const next = new Set(hiddenGroups);
    next.has(g) ? next.delete(g) : next.add(g);
    hiddenGroups = next;
  }
  function toggleExpand(f: Feature) {
    const next = new Set(expanded);
    const k = featKey(f);
    next.has(k) ? next.delete(k) : next.add(k);
    expanded = next;
  }
  function addTag(f: Feature) {
    const tag = window.prompt('Add a tag');
    if (tag && tag.trim()) addFeatureTag(metaKey(f), tag.trim());
  }

  const prefix = (f: Feature) => `${f.name}|${f.source}|`;
  const optionsFor = (f: Feature) => choices.options.filter((o) => o.key.startsWith(prefix(f)));
  const spellsFor = (f: Feature) => choices.spells.filter((s) => s.key.startsWith(prefix(f)));

  function body(entries: unknown[]): string {
    const parts: string[] = [];
    const walk = (x: unknown) => {
      if (typeof x === 'string') parts.push(x);
      else if (Array.isArray(x)) x.forEach(walk);
      else if (x && typeof x === 'object') {
        const o = x as Record<string, unknown>;
        if (typeof o.name === 'string' && (o.entries || o.items)) parts.push(`<b>${o.name}.</b>`);
        walk(o.entries);
        walk(o.items);
        walk(o.entry);
      }
    };
    walk(entries);
    return parts.map((s) => `<p>${renderToHtml(parseTaggedString(s))}</p>`).join('');
  }
</script>

{#snippet featureRow(f: Feature, hideable: boolean)}
  {@const pending = pendingCount(f)}
  <li class:pending={pending > 0}>
    <div class="fhead">
      <span class="grp">{f.group}</span>
      <button class="fname" onclick={() => toggleExpand(f)}>{f.name}</button>
      {#if f.subtitle}<span class="sub">{f.subtitle}</span>{/if}
      {#if pending > 0}<span class="pbadge" title="{pending} choice{pending === 1 ? '' : 's'} to make">{pending}</span>{/if}
      {#each customTags(f) as t}
        <span class="ctag">{t}<button class="x" onclick={() => removeFeatureTag(metaKey(f), t)}>×</button></span>
      {/each}
      <span class="spacer"></span>
      <button class="mini" title="Add tag" onclick={() => addTag(f)}>🏷</button>
      <button class="mini" title={hideable ? 'Hide' : 'Unhide'} onclick={() => setFeatureHidden(metaKey(f), hideable)}>{hideable ? '🛇' : '👁'}</button>
      <button class="mini" onclick={() => toggleExpand(f)}>{expanded.has(featKey(f)) ? '▾' : '▸'}</button>
    </div>

    {#if optionsFor(f).length > 0 || spellsFor(f).length > 0 || isAsi(f)}
      <div class="choices">
        {#if isAsi(f)}
          <select class="opt" value={asiMode(f)} title="Ability increase or feat"
            onchange={(e) => setAsiMode(f, (e.target as HTMLSelectElement).value)}>
            <option value="ability">Ability increase</option>
            <option value="feat">Feat</option>
          </select>
          {#if asiMode(f) === 'ability'}
            <AsiEditor choiceKey={asiKey(f)} value={asiValue(f)} />
          {:else}
            {@const feat = featValue(f)}
            {#if feat}
              <span class="pill picked">
                <button class="pname" title="Change" onclick={() => openFeatPicker({ key: asiKey(f), label: `${f.name}: choose a feat` })}>{feat.name}</button>
                <button class="x" onclick={() => setFeatChoice(asiKey(f), undefined)}>×</button>
              </span>
            {:else}
              <button class="pill empty" onclick={() => openFeatPicker({ key: asiKey(f), label: `${f.name}: choose a feat` })}>+ choose feat</button>
            {/if}
          {/if}
        {/if}
        {#each optionsFor(f) as opt (opt.key)}
          <select class="opt" value={$character.featureOptions[opt.key] ?? ''} title={opt.label}
            onchange={(e) => setFeatureOption(opt.key, (e.target as HTMLSelectElement).value || undefined)}>
            <option value="">{opt.label}…</option>
            {#each opt.options as o}<option value={o.value}>{o.label}</option>{/each}
          </select>
        {/each}
        {#each spellsFor(f) as field (field.key)}
          {@const picked = $character.spellChoices[field.key]}
          {#if picked}
            <span class="pill picked">
              <button class="pname" title="Change" onclick={() => openSpellPicker(field)}>{picked.name}</button>
              <button class="x" onclick={() => setSpellChoice(field.key, undefined)}>×</button>
            </span>
          {:else}
            <button class="pill empty" title={field.label} onclick={() => openSpellPicker(field)}>+ choose spell</button>
          {/if}
        {/each}
      </div>
    {/if}

    {#if expanded.has(featKey(f))}<div class="fbody">{@html body(f.entries)}</div>{/if}
  </li>
{/snippet}

{#snippet progressionRow(p: OptionalProgression)}
  {@const pending = progPending(p)}
  {@const ekey = `prog:${p.key}`}
  <li class:pending={pending > 0}>
    <div class="fhead">
      <span class="grp">{p.group}</span>
      <span class="fname">{p.name}</span>
      <span class="sub">{p.owner} · know {p.count}</span>
      {#if pending > 0}<span class="pbadge" title="{pending} to choose">{pending}</span>{/if}
    </div>
    <div class="choices">
      {#each Array.from({ length: p.count }, (_, i) => i) as i (i)}
        {@const picked = $character.optionalChoices[slotKey(p, i)]}
        {#if picked}
          <span class="pill picked">
            <button class="pname" title="Change" onclick={() => openOptionalPicker({ key: slotKey(p, i), types: p.featureType, label: `Choose ${slotNoun(p)}` })}>{picked.name}</button>
            <button class="x" onclick={() => setOptionalChoice(slotKey(p, i), undefined)}>×</button>
          </span>
        {:else}
          <button class="pill empty" onclick={() => openOptionalPicker({ key: slotKey(p, i), types: p.featureType, label: `Choose ${slotNoun(p)}` })}>+ choose {slotNoun(p)}</button>
        {/if}
      {/each}
    </div>
    {#each Array.from({ length: p.count }, (_, i) => i) as i (i)}
      {@const picked = $character.optionalChoices[slotKey(p, i)]}
      {#if picked && expanded.has(ekey)}
        {@const ent = optionalEntry(picked)}
        {#if ent}<div class="fbody"><b>{ent.name}.</b> {@html body((ent.entries as unknown[]) ?? [])}</div>{/if}
      {/if}
    {/each}
    {#if p.count > 0 && Object.keys($character.optionalChoices).some((k) => k.startsWith(`${p.key}|`))}
      <button class="mini detail" onclick={() => { const next = new Set(expanded); next.has(ekey) ? next.delete(ekey) : next.add(ekey); expanded = next; }}>{expanded.has(ekey) ? '▾ hide' : '▸ details'}</button>
    {/if}
  </li>
{/snippet}

<section class="block" data-variant={variant}>
  <header class="bhead">
    <h3>Features &amp; Traits</h3>
    {#if totalPending + totalProgPending > 0}<span class="hdr-pending">{totalPending + totalProgPending} pending choice{totalPending + totalProgPending === 1 ? '' : 's'}</span>{/if}
  </header>

  <div class="setup">
    <div class="line">
      <span class="k">Race</span>
      {#if $character.race}
        <span class="v">{$character.race.name}</span>
        <button class="x" onclick={() => setRace(undefined)} aria-label="Clear race">×</button>
      {:else}
        <button class="choose" onclick={() => openBrowse('race')}>Choose…</button>
      {/if}
    </div>
    <div class="line">
      <span class="k">Background</span>
      {#if $character.background}
        <span class="v">{$character.background.name}</span>
        <button class="x" onclick={() => setBackground(undefined)} aria-label="Clear background">×</button>
      {:else}
        <button class="choose" onclick={() => openBrowse('background')}>Choose…</button>
      {/if}
    </div>
    {#each $character.classes as cls, i}
      <div class="line">
        <span class="k">{cls.name} subclass</span>
        <select value={cls.subclass ?? ''} onchange={(e) => setSubclass(i, (e.target as HTMLSelectElement).value || undefined)}>
          <option value="">—</option>
          {#each ($catalogState.catalog?.classData.subclass ?? []).filter((s) => String(s.className).toLowerCase() === cls.name.toLowerCase()) as sc}
            <option value={String(sc.shortName ?? sc.name)}>{sc.name}</option>
          {/each}
        </select>
      </div>
    {/each}
    <div class="line feats">
      <span class="k">Feats</span>
      {#each $character.feats as f, i}
        <span class="ctag">{f.name}<button class="x" onclick={() => removeFeat(i)}>×</button></span>
      {/each}
      <button class="choose" onclick={() => openBrowse('feat')}>+ Feat</button>
    </div>
  </div>

  {#if sources.length > 0}
    <div class="srcfilter">
      {#each sources as g}
        <button class="schip" class:on={groupShown(g)} onclick={() => toggleGroup(g)}>{g}</button>
      {/each}
    </div>
  {/if}

  {#if visible.length > 0 || visibleProgs.length > 0}
    <ul class="features">
      {#each visibleProgs as p (p.key)}{@render progressionRow(p)}{/each}
      {#each visible as f (featKey(f))}{@render featureRow(f, true)}{/each}
    </ul>
  {/if}

  {#if hidden.length > 0}
    <button class="hidetoggle" onclick={() => (showHidden = !showHidden)}>
      {showHidden ? '▾' : '▸'} Hidden / applied ({hidden.length})
    </button>
    {#if showHidden}
      <ul class="features hiddenlist">
        {#each hidden as f (featKey(f))}{@render featureRow(f, false)}{/each}
      </ul>
    {/if}
  {/if}

  {#if features.length === 0 && !$catalogState.catalog}
    <p class="empty">Load game data to see class features.</p>
  {/if}
</section>

<style>
  .block { border: 1px solid var(--line); border-radius: 8px; padding: 0.75rem 1rem; }
  .bhead { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.6rem; }
  h3 { margin: 0; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .hdr-pending { font-size: 0.72rem; font-weight: 600; color: #fff; background: var(--accent); border-radius: 999px; padding: 0.05rem 0.5rem; }
  .setup { display: flex; flex-direction: column; gap: 0.3rem; padding-bottom: 0.5rem; margin-bottom: 0.5rem; border-bottom: 1px solid var(--line); }
  .line { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .k { font-size: 0.7rem; text-transform: uppercase; color: var(--muted); min-width: 6rem; }
  .v { font-weight: 600; }
  .choose, select { font: inherit; font-size: 0.78rem; padding: 0.15rem 0.5rem; border: 1px solid var(--line); background: var(--bg); color: var(--fg); border-radius: 6px; cursor: pointer; }
  .choose { color: var(--accent); border-color: var(--accent); }
  .ctag { display: inline-flex; align-items: center; gap: 0.1rem; font-size: 0.72rem; padding: 0.05rem 0.4rem; border: 1px solid var(--line); border-radius: 999px; }
  .x { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 0.95rem; line-height: 1; padding: 0; }
  .x:hover { color: var(--accent); }

  .srcfilter { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-bottom: 0.4rem; }
  .schip { font: inherit; font-size: 0.7rem; padding: 0.1rem 0.5rem; border: 1px solid var(--line); border-radius: 999px; background: var(--bg); color: var(--muted); cursor: pointer; }
  .schip.on { background: var(--accent); border-color: var(--accent); color: #fff; }

  .features { list-style: none; margin: 0; padding: 0; }
  .features li { border-bottom: 1px solid var(--line); padding: 0.15rem 0; }
  .features li.pending { box-shadow: inset 3px 0 0 var(--accent); padding-left: 0.4rem; }
  .pbadge { font-size: 0.6rem; font-weight: 700; color: #fff; background: var(--accent); border-radius: 999px; padding: 0.02rem 0.35rem; }
  .hiddenlist { opacity: 0.7; }
  .fhead { display: flex; align-items: center; gap: 0.4rem; }
  .grp { font-size: 0.58rem; text-transform: uppercase; letter-spacing: 0.03em; color: #fff; background: var(--muted); border-radius: 3px; padding: 0.05rem 0.3rem; }
  .fname { font-weight: 600; background: none; border: none; color: var(--fg); cursor: pointer; padding: 0; font: inherit; }
  .sub { font-size: 0.72rem; color: var(--muted); }
  .spacer { flex: 1; }
  .mini { background: none; border: none; cursor: pointer; font-size: 0.85rem; opacity: 0.7; padding: 0 0.1rem; }
  .mini:hover { opacity: 1; }
  .choices { display: flex; flex-wrap: wrap; gap: 0.3rem; padding: 0.15rem 0 0.25rem 0.2rem; }
  .opt { font-size: 0.74rem; }
  .pill { display: inline-flex; align-items: center; gap: 0.1rem; font: inherit; font-size: 0.76rem; border-radius: 999px; cursor: pointer; }
  .pill.empty { padding: 0.1rem 0.5rem; border: 1px dashed var(--accent); background: var(--bg); color: var(--accent); }
  .pill.picked { padding: 0.1rem 0.2rem 0.1rem 0.5rem; border: 1px solid var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); }
  .pname { background: none; border: none; color: var(--accent); cursor: pointer; font: inherit; font-weight: 600; }
  .fbody { font-size: 0.85rem; padding: 0 0 0.4rem 0.2rem; }
  .fbody :global(p) { margin: 0.25rem 0; }
  .hidetoggle { font: inherit; font-size: 0.78rem; background: none; border: none; color: var(--muted); cursor: pointer; padding: 0.4rem 0 0; }
  .empty { color: var(--muted); font-size: 0.85rem; margin: 0; }
</style>
