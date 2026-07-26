<script lang="ts">
  import {
    unpinCreature,
    damagePinned,
    setPinnedHp,
    adjustPinnedLegendary,
    togglePinnedUse,
    openDetail,
    type PinnedCreature
  } from '../stores/detail.js';
  import { catalogLookup } from '../stores/catalog.js';
  import { rollExpr } from '../stores/dice.js';
  import { buildStatblock } from '../render/statblock.js';
  import Statblock from './Statblock.svelte';

  /**
   * One pinned creature: HP pool, damage/heal, legendary actions and recharges.
   *
   * The full statblock only unfolds *inside* the card on a phone, where there is
   * nowhere else to put it. Anywhere with room, the dock hands it to the detail
   * window instead — a statblock in a 310px rail is a column of two-word lines.
   * `onToggle` is what the caller does with a click; `open` is whether this card
   * is the one showing it inline.
   */
  let {
    c,
    open = false,
    onToggle
  }: { c: PinnedCreature; open?: boolean; onToggle?: (el: HTMLElement) => void } = $props();

  let amount = $state<number>(0);

  const sb = $derived(buildStatblock(c.entry, c.params));

  function applyDamage(sign: 1 | -1) {
    if (amount) damagePinned(c.id, sign * amount);
  }

  // Inside an expanded statblock: roll {@damage}/{@dice}, or open a reference.
  function onRefClick(e: MouseEvent) {
    const roll = (e.target as HTMLElement).closest('.tag-roll') as HTMLElement | null;
    if (roll?.dataset.roll) {
      e.preventDefault();
      rollExpr(roll.dataset.roll, roll.dataset.label);
      return;
    }
    const a = (e.target as HTMLElement).closest('a.tag-ref') as HTMLElement | null;
    if (!a?.dataset.name) return;
    e.preventDefault();
    const creature = $catalogLookup.getCreatureByName(a.dataset.name);
    const spell = $catalogLookup.getSpellByName(a.dataset.name);
    if (creature) openDetail('creature', creature, a);
    else if (spell) openDetail('spell', spell, a);
  }
</script>

<div class="card" class:open>
  <header class="chead">
    <button class="cname" title="Expand statblock" onclick={(e) => onToggle?.(e.currentTarget)}>{sb.name}</button>
    {#if sb.acValue != null}<span class="ac" title={sb.ac}>AC {sb.acValue}</span>{/if}
    <button class="unpin" title="Unpin" aria-label="Unpin" onclick={() => unpinCreature(c.id)}>×</button>
  </header>

  <div class="hp">
    <span class="k">HP</span>
    <input
      class="n"
      type="number"
      aria-label="Current hit points"
      value={c.hp.current}
      onchange={(e) => setPinnedHp(c.id, 'current', Number((e.target as HTMLInputElement).value) || 0)}
    />
    <span class="slash">/</span>
    <input
      class="n"
      type="number"
      aria-label="Maximum hit points"
      value={c.hp.max}
      onchange={(e) => setPinnedHp(c.id, 'max', Number((e.target as HTMLInputElement).value) || 0)}
    />
    {#if c.hp.temp > 0}<span class="temp" title="Temporary HP">+{c.hp.temp}</span>{/if}
  </div>

  <div class="dmg">
    <input
      class="amt"
      type="number"
      min="0"
      placeholder="0"
      aria-label="Damage or healing amount"
      value={amount || ''}
      oninput={(e) => (amount = Number((e.target as HTMLInputElement).value) || 0)}
    />
    <button class="dbtn dmgbtn" title="Apply damage" onclick={() => applyDamage(1)}>−</button>
    <button class="dbtn healbtn" title="Heal" onclick={() => applyDamage(-1)}>+</button>
    <input
      class="amt temp"
      type="number"
      min="0"
      title="Set temporary HP"
      aria-label="Temporary hit points"
      value={c.hp.temp || ''}
      placeholder="tmp"
      onchange={(e) => setPinnedHp(c.id, 'temp', Number((e.target as HTMLInputElement).value) || 0)}
    />
  </div>

  {#if sb.legendary}
    <div class="uses">
      <span class="k">Legendary</span>
      <span class="pips">
        {#each Array(sb.legendary) as _, i}
          <button
            class="pip"
            class:on={i >= c.legendaryUsed}
            aria-label="Legendary action {i + 1}"
            onclick={() => adjustPinnedLegendary(c.id, i >= c.legendaryUsed ? 1 : -1, sb.legendary!)}
          ></button>
        {/each}
      </span>
    </div>
  {/if}

  {#if sb.recharge.length}
    <div class="recharge">
      {#each sb.recharge as name}
        <button
          class="rtag"
          class:spent={c.uses?.[name]}
          title={c.uses?.[name] ? `${name} — expended, click when recharged` : `${name} — click to mark used`}
          onclick={() => togglePinnedUse(c.id, name)}
        >{name}</button>
      {/each}
    </div>
  {/if}

  {#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="full" onclick={onRefClick}>
      <Statblock {sb} compact />
    </div>
  {/if}
</div>

<style>
  .card { border: 1px solid var(--line); border-radius: 8px; background: var(--bg); padding: 0.4rem 0.5rem; font-size: 0.8rem; }
  .chead { display: flex; align-items: center; gap: 0.3rem; }
  .cname { flex: 1; min-width: 0; text-align: left; font: inherit; font-weight: 700; color: var(--accent); background: none; border: none; padding: 0; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cname:hover { text-decoration: underline; }
  .ac { flex: none; font-size: 0.72rem; color: var(--muted); border: 1px solid var(--line); border-radius: 4px; padding: 0 0.3rem; }
  .unpin { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 1rem; line-height: 1; }
  .unpin:hover { color: var(--accent); }
  .hp { display: flex; align-items: center; gap: 0.3rem; margin-top: 0.3rem; }
  .hp .k, .uses .k { font-size: 0.62rem; text-transform: uppercase; color: var(--muted); }
  .n { width: 4ch; font: inherit; text-align: center; border: 1px solid var(--line); border-radius: 4px; background: var(--bg); color: var(--fg); padding: 0.05rem; }
  .slash { color: var(--muted); }
  .temp { color: #3fa45b; font-weight: 600; font-size: 0.75rem; }
  .dmg { display: flex; align-items: center; gap: 0.25rem; margin-top: 0.25rem; }
  .amt { width: 3.5ch; font: inherit; text-align: center; border: 1px solid var(--line); border-radius: 4px; background: var(--bg); color: var(--fg); padding: 0.05rem; }
  .amt.temp { width: 3.5ch; margin-left: auto; }
  .dbtn { width: 1.4rem; height: 1.4rem; border: 1px solid var(--line); border-radius: 4px; background: var(--bg); cursor: pointer; line-height: 1; font-weight: 700; }
  .dmgbtn { color: #d2645a; }
  .healbtn { color: #3fa45b; }
  .uses { display: flex; align-items: center; gap: 0.35rem; margin-top: 0.3rem; }
  .pips { display: inline-flex; gap: 0.2rem; }
  .pip { width: 0.8rem; height: 0.8rem; border-radius: 50%; border: 1.5px solid var(--muted); background: transparent; cursor: pointer; padding: 0; }
  .pip.on { background: var(--accent); border-color: var(--accent); }
  .recharge { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.3rem; }
  .rtag { font: inherit; font-size: 0.68rem; padding: 0.05rem 0.35rem; border: 1px solid var(--line); border-radius: 999px; background: var(--bg); color: var(--fg); cursor: pointer; }
  .rtag.spent { opacity: 0.45; text-decoration: line-through; }
  .full { margin-top: 0.4rem; border-top: 1px solid var(--line); padding-top: 0.4rem; max-height: 40vh; overflow: auto; }
  /* Trim the number spinners so 2–3 digit HP fits the compact fields. */
  .n, .amt { appearance: textfield; -moz-appearance: textfield; }
  .n::-webkit-outer-spin-button, .n::-webkit-inner-spin-button,
  .amt::-webkit-outer-spin-button, .amt::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
</style>
