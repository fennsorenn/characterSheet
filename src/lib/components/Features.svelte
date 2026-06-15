<script lang="ts">
  import {
    character,
    setRace,
    setBackground,
    removeFeat,
    setSubclass,
    setSpellChoice,
    setFeatureOption,
    setFeatureHidden,
    addFeatureTag,
    removeFeatureTag
  } from '../stores/character.js';
  import { catalogState } from '../stores/catalog.js';
  import { openBrowse } from '../stores/browse.js';
  import { openSpellPicker } from '../stores/spellPicker.js';
  import { resolveFeatures, featureChoices, type Feature } from '../character/index.js';
  import { parseTaggedString, renderToHtml } from '../render/tags.js';

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

  // --- per-feature identity / hidden / tags ---
  const metaKey = (f: Feature) => `${f.name}|${f.source}`;
  const featKey = (f: Feature) => `${f.group}:${f.name}:${f.subtitle ?? ''}`;
  const autoHidden = (f: Feature) => /ability score improvement/i.test(f.name);
  const isHidden = (f: Feature) =>
    $character.featureMeta[metaKey(f)]?.hidden ?? autoHidden(f);
  const customTags = (f: Feature) => $character.featureMeta[metaKey(f)]?.tags ?? [];

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
  <li>
    <div class="fhead">
      <span class="grp">{f.group}</span>
      <button class="fname" onclick={() => toggleExpand(f)}>{f.name}</button>
      {#if f.subtitle}<span class="sub">{f.subtitle}</span>{/if}
      {#each customTags(f) as t}
        <span class="ctag">{t}<button class="x" onclick={() => removeFeatureTag(metaKey(f), t)}>×</button></span>
      {/each}
      <span class="spacer"></span>
      <button class="mini" title="Add tag" onclick={() => addTag(f)}>🏷</button>
      <button class="mini" title={hideable ? 'Hide' : 'Unhide'} onclick={() => setFeatureHidden(metaKey(f), hideable)}>{hideable ? '🛇' : '👁'}</button>
      <button class="mini" onclick={() => toggleExpand(f)}>{expanded.has(featKey(f)) ? '▾' : '▸'}</button>
    </div>

    {#if optionsFor(f).length > 0 || spellsFor(f).length > 0}
      <div class="choices">
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

<section class="block" data-variant={variant}>
  <h3>Features &amp; Traits</h3>

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

  {#if visible.length > 0}
    <ul class="features">
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
  h3 { margin: 0 0 0.6rem; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
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
