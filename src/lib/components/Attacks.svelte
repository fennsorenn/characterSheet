<script lang="ts">
  import { character, graph, grantPool, setItemProficient } from '../stores/character.js';
  import { catalogLookup } from '../stores/catalog.js';
  import { openDetail } from '../stores/detail.js';
  import {
    weaponAttacks,
    weaponProficiencySet,
    iconForItem,
    iconForDamageType,
    iconLabel,
    ABILITY_NAMES
  } from '../character/index.js';
  import StatValue from './StatValue.svelte';
  import Icon from './Icon.svelte';
  import { get } from 'svelte/store';
  import { rollParts, diceMode } from '../stores/dice.js';
  import { rollD20, rollTerms, parseDice } from '../dice/dice.js';
  import type { WeaponAttack } from '../character/index.js';

  let { variant = 'full' }: { variant?: string } = $props();

  const sign = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n)}`;

  function toHitLabel(a: WeaponAttack): string {
    const abil = $graph.has(`ability.${a.ability}.mod`) ? $graph.get(`ability.${a.ability}.mod`) : 0;
    const parts = [`${ABILITY_NAMES[a.ability].slice(0, 3)} ${sign(abil)}`];
    if (a.proficient && $graph.has('prof.bonus')) parts.push(`prof ${sign($graph.get('prof.bonus'))}`);
    if (a.attackBonus) parts.push(`magic ${sign(a.attackBonus)}`);
    for (const m of $graph.explain(`attack.${a.id}.hit`).modifiers) if (m.applied) parts.push(`${m.source} ${sign(m.value)}`);
    return parts.join(', ');
  }
  function dmgLabel(a: WeaponAttack): string {
    const abil = $graph.has(`ability.${a.ability}.mod`) ? $graph.get(`ability.${a.ability}.mod`) : 0;
    return `${ABILITY_NAMES[a.ability].slice(0, 3)} ${sign(abil)}${a.damageBonus ? `, magic ${sign(a.damageBonus)}` : ''}`;
  }

  function openWeaponDetail(idx: number, el: Element) {
    const inv = $character.inventory[idx];
    const entry = inv && $catalogLookup.getItem(inv.name, inv.source);
    if (entry) openDetail('item', entry, el.closest('.cell') ?? el);
  }

  /** Roll the attack d20 (adv/disadv per the roller's mode) and its damage together. */
  function rollAttack(a: WeaponAttack) {
    const toHit = $graph.has(`attack.${a.id}.hit`) ? $graph.get(`attack.${a.id}.hit`) : 0;
    const dmgMod = $graph.has(`attack.${a.id}.dmg`) ? $graph.get(`attack.${a.id}.dmg`) : 0;
    const parts = [rollD20(get(diceMode), toHit, 'Attack', { modifierLabel: toHitLabel(a) })];
    const { terms } = parseDice(a.damageDice || '');
    if (terms.length) {
      parts.push(rollTerms(terms, dmgMod, `Damage${a.damageType ? ` ${a.damageType}` : ''}`, { modifierLabel: dmgLabel(a) }));
    }
    rollParts(a.name, parts);
  }

  // Default each weapon's proficiency from the character's actual proficiencies.
  const weaponProfs = $derived(
    weaponProficiencySet($grantPool.sets.filter((s) => s.category === 'weaponProf').map((s) => s.member))
  );
  const attacks = $derived(weaponAttacks($character, $catalogLookup, weaponProfs));

  // Damage string: dice + the graph-computed bonus (ability mod + magic) + type.
  function damage(id: string, dice: string, type: string): string {
    const bonus = $graph.has(`attack.${id}.dmg`) ? $graph.get(`attack.${id}.dmg`) : 0;
    const sign = bonus > 0 ? `+${bonus}` : bonus < 0 ? `${bonus}` : '';
    return `${dice}${sign}${type ? ` ${type}` : ''}`;
  }
</script>

<section class="block" data-variant={variant}>
  <h3>Attacks</h3>
  {#if attacks.length === 0}
    <p class="empty">Equip a weapon (quick import → inventory → equip) to see attacks here.</p>
  {:else}
    <ul>
      {#each attacks as a (a.id)}
        {@const idx = Number(a.id.slice(1))}
        {@const wic = iconForItem({ name: a.name })}
        <li>
          <span class="wicon" title={iconLabel(wic)}><Icon name={wic} /></span>
          <button class="name" title="Show details" onclick={(e) => openWeaponDetail(idx, e.currentTarget)}>{a.name}</button>
          <span class="hit" title="{ABILITY_NAMES[a.ability]} attack">
            <StatValue node={`attack.${a.id}.hit`} signed />
          </span>
          <span class="dmg">
            {damage(a.id, a.damageDice, '')}
            {#if iconForDamageType(a.damageType)}
              <span class="dicon" title={a.damageType}><Icon name={iconForDamageType(a.damageType)!} /></span>
            {/if}
            {#if a.versatileDice}<span class="vers">({damage(a.id, a.versatileDice, '')} 2-h)</span>{/if}
          </span>
          <button
            class="prof"
            class:on={a.proficient}
            title={a.proficient ? 'Proficient' : 'Not proficient'}
            onclick={() => setItemProficient(idx, !a.proficient)}
          >prof</button>
          <button class="roll" title="Roll attack + damage" aria-label="Roll {a.name}" onclick={() => rollAttack(a)}><Icon name="dice" /></button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .block { border: 1px solid var(--line); border-radius: 8px; padding: 0.75rem 1rem; }
  h3 { margin: 0 0 0.6rem; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .empty { color: var(--muted); font-size: 0.85rem; margin: 0; }
  ul { list-style: none; margin: 0; padding: 0; }
  li {
    display: grid;
    grid-template-columns: auto 1fr auto auto auto auto;
    align-items: center;
    gap: 0.6rem;
    padding: 0.3rem 0;
    border-bottom: 1px solid var(--line);
  }
  .wicon { color: var(--muted); display: inline-flex; }
  .wicon :global(.icon) { width: 1.05rem; height: 1.05rem; }
  .name { min-width: 0; font-weight: 600; text-align: left; background: none; border: none; padding: 0; color: var(--fg); font: inherit; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .name:hover { color: var(--accent); }
  .hit { font-weight: 700; }
  .dmg { font-size: 0.85rem; color: var(--muted); font-variant-numeric: tabular-nums; display: inline-flex; align-items: center; gap: 0.25rem; }
  .dicon { display: inline-flex; }
  .dicon :global(.icon) { width: 0.9rem; height: 0.9rem; }
  .vers { font-size: 0.75rem; }
  .prof {
    font: inherit; font-size: 0.65rem; text-transform: uppercase;
    padding: 0.1rem 0.4rem;
    border: 1px solid var(--line); border-radius: 4px;
    background: var(--bg); color: var(--muted); cursor: pointer;
  }
  .prof.on { background: var(--accent); border-color: var(--accent); color: #fff; }
  .roll { font: inherit; font-size: 1rem; line-height: 1; padding: 0.1rem 0.35rem; border: 1px solid var(--accent); border-radius: 5px; background: var(--bg); color: var(--accent); cursor: pointer; }
  .roll:hover { background: var(--accent); color: #fff; }
  /* In a narrow cell the fixed grid can't fit; wrap the stats under the name. */
  @container cell (max-width: 340px) {
    li { display: flex; flex-wrap: wrap; gap: 0.35rem 0.6rem; }
    .name { flex: 1 1 60%; white-space: normal; overflow-wrap: anywhere; }
  }
</style>
