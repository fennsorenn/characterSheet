<script lang="ts">
  import {
    character,
    setRace,
    setBackground,
    removeFeat,
    setSubclass
  } from '../stores/character.js';
  import { catalogState } from '../stores/catalog.js';
  import { openBrowse } from '../stores/browse.js';
  import { setSpellChoice } from '../stores/character.js';
  import { openSpellPicker } from '../stores/spellPicker.js';
  import { resolveFeatures, featureSpellChoices, type Feature, type ChoiceSlot } from '../character/index.js';
  import { parseTaggedString, renderToHtml } from '../render/tags.js';

  let { variant = 'full' }: { variant?: string } = $props();

  let expanded = $state<Set<string>>(new Set());

  const features = $derived<Feature[]>(
    $catalogState.catalog ? resolveFeatures($character, $catalogState.catalog) : []
  );
  const allChoices = $derived<ChoiceSlot[]>(
    $catalogState.catalog ? featureSpellChoices($character, $catalogState.catalog) : []
  );
  const choicesFor = (f: Feature): ChoiceSlot[] =>
    allChoices.filter((s) => s.key.startsWith(`${f.name}|${f.source}|`));

  function subclassesFor(className: string) {
    const subs = $catalogState.catalog?.classData.subclass ?? [];
    const seen = new Set<string>();
    return subs.filter((s) => {
      if (String(s.className).toLowerCase() !== className.toLowerCase()) return false;
      const k = String(s.shortName ?? s.name).toLowerCase();
      return seen.has(k) ? false : seen.add(k);
    });
  }

  const key = (f: Feature) => `${f.group}:${f.name}:${f.subtitle ?? ''}`;
  function toggle(f: Feature) {
    const next = new Set(expanded);
    const k = key(f);
    next.has(k) ? next.delete(k) : next.add(k);
    expanded = next;
  }

  // Flatten a feature's entries to HTML paragraphs (inline {@tags} rendered).
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
        <select
          value={cls.subclass ?? ''}
          onchange={(e) => setSubclass(i, (e.target as HTMLSelectElement).value || undefined)}
        >
          <option value="">—</option>
          {#each subclassesFor(cls.name) as sc}
            <option value={String(sc.shortName ?? sc.name)}>{sc.name}</option>
          {/each}
        </select>
      </div>
    {/each}
    <div class="line feats">
      <span class="k">Feats</span>
      {#each $character.feats as f, i}
        <span class="chip">{f.name}<button class="x" onclick={() => removeFeat(i)} aria-label="Remove feat">×</button></span>
      {/each}
      <button class="choose" onclick={() => openBrowse('feat')}>+ Feat</button>
    </div>
  </div>

  {#if features.length > 0}
    <ul class="features">
      {#each features as f (key(f))}
        <li>
          <button class="fhead" onclick={() => toggle(f)}>
            <span class="grp">{f.group}</span>
            <span class="fname">{f.name}</span>
            {#if f.subtitle}<span class="sub">{f.subtitle}</span>{/if}
            <span class="caret">{expanded.has(key(f)) ? '▾' : '▸'}</span>
          </button>
          {#if expanded.has(key(f))}
            <div class="fbody">{@html body(f.entries)}</div>
          {/if}
          {#if choicesFor(f).length > 0}
            <div class="choices">
              {#each choicesFor(f) as slot (slot.key)}
                {@const picked = $character.spellChoices[slot.key]}
                {#if picked}
                  <span class="pill picked">
                    <button class="pname" title="Change spell" onclick={() => openSpellPicker(slot)}>{picked.name}</button>
                    <button class="px" title="Clear" onclick={() => setSpellChoice(slot.key, undefined)}>×</button>
                  </span>
                {:else}
                  <button class="pill empty" title={slot.label} onclick={() => openSpellPicker(slot)}>+ choose spell</button>
                {/if}
              {/each}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {:else if !$catalogState.catalog}
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
  .chip { display: inline-flex; align-items: center; gap: 0.15rem; font-size: 0.78rem; padding: 0.1rem 0.45rem; border: 1px solid var(--line); border-radius: 999px; }
  .x { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 0.95rem; line-height: 1; }
  .x:hover { color: var(--accent); }

  .features { list-style: none; margin: 0; padding: 0; }
  .features li { border-bottom: 1px solid var(--line); }
  .fhead { display: flex; align-items: baseline; gap: 0.5rem; width: 100%; text-align: left; background: none; border: none; padding: 0.35rem 0; cursor: pointer; color: var(--fg); }
  .grp { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.03em; color: #fff; background: var(--muted); border-radius: 3px; padding: 0.05rem 0.3rem; }
  .fname { font-weight: 600; flex: 1; }
  .sub { font-size: 0.72rem; color: var(--muted); }
  .caret { color: var(--muted); }
  .fbody { font-size: 0.85rem; color: var(--fg); padding: 0 0 0.5rem 0.2rem; }
  .fbody :global(p) { margin: 0.25rem 0; }
  .choices { display: flex; flex-wrap: wrap; gap: 0.3rem; padding: 0 0 0.45rem 0.2rem; }
  .pill { display: inline-flex; align-items: center; gap: 0.1rem; font: inherit; font-size: 0.78rem; border-radius: 999px; cursor: pointer; }
  .pill.empty { padding: 0.1rem 0.5rem; border: 1px dashed var(--accent); background: var(--bg); color: var(--accent); }
  .pill.picked { padding: 0.1rem 0.2rem 0.1rem 0.5rem; border: 1px solid var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); }
  .pname { background: none; border: none; color: var(--accent); cursor: pointer; font: inherit; font-weight: 600; }
  .px { background: none; border: none; color: var(--muted); cursor: pointer; line-height: 1; font-size: 0.9rem; }
  .px:hover { color: var(--accent); }
  .empty { color: var(--muted); font-size: 0.85rem; margin: 0; }
</style>
