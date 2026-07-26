<script lang="ts">
  import {
    diceMode,
    diceDetailed,
    diceLog,
    rollOneDie,
    rollExpr,
    clearLog
  } from '../stores/dice.js';
  import { partDetail, type RollGroup, type RollPart } from '../dice/dice.js';
  import Icon from './Icon.svelte';
  import UiIcon from './UiIcon.svelte';

  /**
   * The roller itself — dice, expression, latest result, log — without any
   * chrome. It has two hosts: a draggable floating window on a desktop, and the
   * dock's panel on a phone, where a 300px window over a 420px screen was never
   * going to sit comfortably next to the dock it overlapped.
   *
   * The advantage/detail toggles live here rather than in the window's title
   * bar so they come along to whichever host is rendering it.
   */
  const DICE = [20, 12, 10, 8, 6, 4, 100];

  let expr = $state('');
  let showLog = $state(false);

  const latest = $derived($diceLog[0]);
  const older = $derived($diceLog.slice(1));

  function submitExpr(e: Event) {
    e.preventDefault();
    rollExpr(expr);
    expr = '';
  }

  const groupTotals = (g: RollGroup) => g.parts.map((p) => `${p.label} ${p.total}`).join(' · ');
</script>

{#snippet part(p: RollPart)}
  <div class="part">
    <span class="plabel">{p.label}</span>
    {#if $diceDetailed}
      <span class="expr">
        {#each p.dice as d, i}
          {#if i > 0}<span class="op">+</span>{/if}
          <span class="die" class:dropped={d.dropped}>{Math.abs(d.value)}</span>
        {/each}
        {#if p.modifier}
          <span class="op">{p.modifier >= 0 ? '+' : '−'}</span>
          <span class="mod" title={p.modifierLabel ?? 'modifier'}>{Math.abs(p.modifier)}</span>
        {/if}
        <span class="op">=</span>
      </span>
    {/if}
    <span class="total" title={$diceDetailed ? p.modifierLabel : partDetail(p)}>{p.total}</span>
  </div>
{/snippet}

<div class="rollmodes">
  <div class="modes">
    <button class:on={$diceMode === 'disadv'} title="Disadvantage" onclick={() => diceMode.set('disadv')}>−</button>
    <button class:on={$diceMode === 'normal'} title="Normal" onclick={() => diceMode.set('normal')}>•</button>
    <button class:on={$diceMode === 'adv'} title="Advantage" onclick={() => diceMode.set('adv')}>+</button>
  </div>
  <button class="ic" title={$diceDetailed ? 'Concise' : 'Detailed'} onclick={() => diceDetailed.update((d) => !d)}>{$diceDetailed ? '≣' : '≡'}</button>
</div>

<div class="quick">
  {#each DICE as f}<button onclick={() => rollOneDie(f)}>d{f}</button>{/each}
</div>
<form class="customrow" onsubmit={submitExpr}>
  <input placeholder="2d6+3…" bind:value={expr} />
  <button type="submit">Roll</button>
</form>

{#if latest}
  <div class="latest">
    <div class="gtitle">{latest.title}</div>
    {#each latest.parts as p}{@render part(p)}{/each}
  </div>
{:else}
  <p class="empty">Roll a die, type an expression, or hit <Icon name="dice" /> on an attack/spell.</p>
{/if}

{#if older.length}
  <button class="logtoggle" onclick={() => (showLog = !showLog)}><UiIcon name={showLog ? 'chevron-down' : 'chevron-right'} /> Log ({older.length})</button>
  {#if showLog}
    <ul class="log">
      {#each older as g (g.id)}
        <li title={g.parts.map((p) => `${p.label}: ${partDetail(p)}`).join('\n')}>
          <span class="lt">{g.title}</span><span class="lv">{groupTotals(g)}</span>
        </li>
      {/each}
    </ul>
    <button class="clear" onclick={clearLog}>Clear log</button>
  {/if}
{/if}

<style>
  .rollmodes { display: flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.5rem 0; }
  .modes { display: inline-flex; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
  .modes button { background: var(--bg); border: none; color: var(--muted); cursor: pointer; font: inherit; font-size: 0.8rem; width: 1.5rem; padding: 0.1rem 0; }
  .modes button.on { background: var(--accent); color: #fff; }
  .ic { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 1.05rem; line-height: 1; padding: 0 0.2rem; margin-left: auto; }
  .ic:hover { color: var(--accent); }
  .quick { display: flex; flex-wrap: wrap; gap: 0.25rem; padding: 0.5rem 0.5rem 0.25rem; }
  .quick button { font: inherit; font-size: 0.74rem; padding: 0.15rem 0.45rem; border: 1px solid var(--line); border-radius: 5px; background: var(--bg); color: var(--fg); cursor: pointer; }
  .quick button:hover { border-color: var(--accent); color: var(--accent); }
  .customrow { display: flex; gap: 0.3rem; padding: 0.1rem 0.5rem 0.4rem; }
  .customrow input { flex: 1; min-width: 0; font: inherit; font-size: 0.78rem; padding: 0.2rem 0.4rem; border: 1px solid var(--line); border-radius: 5px; background: var(--bg); color: var(--fg); }
  .customrow button { font: inherit; font-size: 0.76rem; padding: 0.2rem 0.6rem; border: 1px solid var(--accent); border-radius: 5px; background: var(--accent); color: #fff; cursor: pointer; }
  .latest { padding: 0.4rem 0.6rem; border-top: 1px solid var(--line); overflow: auto; }
  .gtitle { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted); margin-bottom: 0.2rem; }
  .part { display: flex; align-items: center; gap: 0.4rem; padding: 0.15rem 0; flex-wrap: wrap; }
  .plabel { font-size: 0.78rem; min-width: 4rem; color: var(--fg); }
  .expr { display: inline-flex; align-items: center; gap: 0.2rem; flex-wrap: wrap; font-variant-numeric: tabular-nums; }
  .die { display: inline-flex; align-items: center; justify-content: center; min-width: 1.3rem; height: 1.3rem; padding: 0 0.2rem; border: 1px solid var(--accent); border-radius: 4px; font-size: 0.78rem; font-weight: 600; }
  .die.dropped { opacity: 0.4; border-color: var(--muted); text-decoration: line-through; }
  .op { color: var(--muted); font-size: 0.8rem; }
  .mod { border-bottom: 1px dotted var(--muted); cursor: help; font-size: 0.8rem; }
  .total { margin-left: auto; font-weight: 800; font-size: 1rem; }
  .empty { color: var(--muted); font-size: 0.8rem; padding: 0.5rem 0.6rem; margin: 0; }
  .logtoggle { font: inherit; font-size: 0.74rem; background: none; border: none; border-top: 1px solid var(--line); color: var(--muted); cursor: pointer; text-align: left; padding: 0.35rem 0.6rem; width: 100%; }
  .log { list-style: none; margin: 0; padding: 0 0.6rem; overflow: auto; max-height: 30vh; }
  .log li { display: flex; gap: 0.5rem; font-size: 0.74rem; padding: 0.15rem 0; border-bottom: 1px solid var(--line); cursor: help; }
  .log .lt { flex: 1; color: var(--fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .log .lv { color: var(--muted); font-variant-numeric: tabular-nums; }
  .clear { font: inherit; font-size: 0.72rem; background: none; border: none; color: var(--accent); cursor: pointer; padding: 0.3rem 0.6rem; text-align: left; }
</style>
