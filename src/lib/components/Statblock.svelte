<script lang="ts">
  import type { Statblock } from '../render/statblock.js';

  // Presentational statblock. Interaction (clicking {@creature}/{@spell} refs) is
  // handled by the parent via event delegation on a wrapping element.
  let { sb, compact = false }: { sb: Statblock; compact?: boolean } = $props();
</script>

<div class="statblock" class:compact>
  <div class="top">
    <div class="pill"><span class="k">AC</span> {sb.ac || '—'}</div>
    <div class="pill"><span class="k">HP</span> {sb.hp || '—'}</div>
    {#if sb.speed}<div class="pill"><span class="k">Speed</span> {sb.speed}</div>{/if}
  </div>

  <div class="abilities">
    {#each sb.abilities as a (a.key)}
      <div class="ab">
        <span class="name">{a.key}</span>
        <span class="score">{a.score}</span>
        <span class="mod">{a.mod >= 0 ? '+' : ''}{a.mod}</span>
      </div>
    {/each}
  </div>

  {#if sb.lines.length}
    <div class="lines">
      {#each sb.lines as l}
        <p><span class="k">{l.label}</span> {l.value}</p>
      {/each}
    </div>
  {/if}

  {#each sb.groups as g}
    <section class="group">
      <h4>{g.title}</h4>
      {#each g.items as it}
        <div class="entry">
          {#if it.name}<span class="ename">{it.name}.</span>{/if}
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          <span class="ebody">{@html it.html}</span>
        </div>
      {/each}
    </section>
  {/each}
</div>

<style>
  .statblock { font-size: 0.85rem; }
  .statblock.compact { font-size: 0.78rem; }
  .top { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.5rem; }
  .pill { border: 1px solid var(--line); border-radius: 6px; padding: 0.15rem 0.45rem; }
  .pill .k, .lines .k { font-size: 0.65rem; text-transform: uppercase; color: var(--muted); margin-right: 0.25rem; }
  .abilities { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.25rem; margin-bottom: 0.5rem; }
  .ab { border: 1px solid var(--line); border-radius: 6px; text-align: center; padding: 0.2rem 0; display: flex; flex-direction: column; }
  .ab .name { font-size: 0.6rem; text-transform: uppercase; color: var(--muted); }
  .ab .score { font-weight: 600; }
  .ab .mod { font-size: 0.72rem; color: var(--muted); }
  .lines { border-left: 2px solid var(--line); padding-left: 0.5rem; margin-bottom: 0.5rem; }
  .lines p { margin: 0.12rem 0; }
  .group { margin-top: 0.5rem; }
  .group h4 { margin: 0 0 0.2rem; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--accent); border-bottom: 1px solid var(--line); padding-bottom: 0.1rem; }
  .entry { margin: 0.25rem 0; }
  .ename { font-weight: 600; font-style: italic; margin-right: 0.25rem; }
  .ebody :global(p) { display: inline; margin: 0; }
  .statblock :global(a.tag-ref) { color: var(--accent); cursor: pointer; text-decoration: underline dotted; }
  .statblock :global(.tag-roll) { color: var(--accent); cursor: pointer; }
</style>
