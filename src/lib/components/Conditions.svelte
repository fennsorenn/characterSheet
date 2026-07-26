<script lang="ts">
  import { canEditPlay } from '../stores/mode.js';
  import { CONDITIONS } from '../character/index.js';
  import { character, toggleCondition, setExhaustion } from '../stores/character.js';
  import { conditionRules } from '../stores/catalog.js';
  import { renderEntriesHtml } from '../render/entries.js';
  import { rulesTip } from './rulesTip.js';
  import { showTip } from '../stores/tip.js';
  import type { TipParams } from './rulesTip.js';

  let { variant = 'full' }: { variant?: string } = $props();
  const active = $derived(new Set($character.conditions));

  // Rules text comes from the loaded catalog, so it is absent until a dataset is
  // imported — the chips work either way, they just have nothing to explain.
  const rendered = $derived.by(() => {
    const out = new Map<string, TipParams>();
    for (const [key, rule] of $conditionRules) {
      out.set(key, { title: rule.name, source: rule.source, html: renderEntriesHtml(rule.entries) });
    }
    return out;
  });
  const tipFor = (name: string): TipParams => rendered.get(name.toLowerCase()) ?? null;
  const exhaustionTip = $derived(tipFor('Exhaustion'));
</script>

<section class="block" data-variant={variant}>
  <h3>Conditions</h3>

  <div class="chips">
    {#each CONDITIONS as cond}
      <!--
        aria-disabled, not disabled: a browser dispatches no pointer events at a
        disabled control, and read mode is exactly when someone wants to hover a
        condition and read what it does. Locked means "cannot be changed", not
        "cannot be asked about".
      -->
      <button
        class="chip"
        class:on={active.has(cond)}
        class:hasrules={!!tipFor(cond)}
        aria-disabled={!$canEditPlay}
        onclick={() => $canEditPlay && toggleCondition(cond)}
        use:rulesTip={tipFor(cond)}
      >
        {cond}
      </button>
    {/each}
  </div>

  <div class="exhaust">
    <!-- The label has no other job, so a plain tap can open its rules; the
         chips need the hold, since tapping one toggles the condition. -->
    {#if exhaustionTip}
      <button
        class="lbl hasrules"
        type="button"
        use:rulesTip={exhaustionTip}
        onclick={(e) => showTip(e.currentTarget, exhaustionTip)}
      >Exhaustion</button>
    {:else}
      <span class="lbl">Exhaustion</span>
    {/if}
    <div class="steps">
      {#each [1, 2, 3, 4, 5, 6] as n}
        <button
        disabled={!$canEditPlay}
          class="step"
          class:on={$character.exhaustion >= n}
          aria-label="Exhaustion {n}"
          onclick={() => setExhaustion($character.exhaustion === n ? n - 1 : n)}
        >{n}</button>
      {/each}
    </div>
    {#if $character.exhaustion > 0}
      <span class="pen">−{2 * $character.exhaustion} to d20 tests</span>
    {/if}
  </div>
</section>

<style>
  .block { border: 1px solid var(--line); border-radius: 8px; padding: 0.75rem 1rem; }
  h3 { margin: 0 0 0.6rem; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .chips { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .chip {
    font: inherit;
    font-size: 0.78rem;
    padding: 0.2rem 0.5rem;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--bg);
    color: var(--muted);
    cursor: pointer;
  }
  .chip.on { background: var(--accent); border-color: var(--accent); color: #fff; }
  .chip[aria-disabled='true'] { opacity: 0.5; cursor: not-allowed; }
  /* Something to explain: a dotted underline, the sheet's existing "there is
     more behind this" cue. Held-open on touch, hovered with a mouse. */
  .hasrules { text-decoration: underline dotted var(--line); text-underline-offset: 0.2em; }
  .chip.hasrules.on { text-decoration-color: rgba(255, 255, 255, 0.6); }
  .lbl.hasrules { cursor: help; }
  .exhaust { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.75rem; flex-wrap: wrap; }
  .lbl { font-size: 0.7rem; text-transform: uppercase; color: var(--muted); }
  button.lbl { font-family: inherit; letter-spacing: inherit; padding: 0; border: none; background: none; }
  .steps { display: flex; gap: 0.2rem; }
  .step {
    width: 1.6rem; height: 1.6rem;
    border: 1px solid var(--line);
    border-radius: 4px;
    background: var(--bg);
    color: var(--fg);
    cursor: pointer;
  }
  .step.on { background: var(--accent); border-color: var(--accent); color: #fff; }
  .pen { font-size: 0.75rem; color: var(--accent); }
</style>
