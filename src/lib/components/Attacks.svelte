<script lang="ts">
  import { canEditBuild } from '../stores/mode.js';
  import {
    character,
    graph,
    grantPool,
    setItemProficient,
    addCustomAttack,
    updateCustomAttack,
    removeCustomAttack
  } from '../stores/character.js';
  import { catalogLookup } from '../stores/catalog.js';
  import { openDetail } from '../stores/detail.js';
  import { openCustomEntry } from '../stores/customEntry.js';
  import {
    weaponAttacks,
    weaponProficiencySet,
    iconForItem,
    iconForDamageType,
    iconLabel,
    ABILITY_NAMES,
    ABILITIES,
    customAttackNode,
    type CustomAttack
  } from '../character/index.js';
  import StatValue from './StatValue.svelte';
  import Reminders from './Reminders.svelte';
  import { anchors } from '../character/index.js';
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
    if (!inv) return;
    const anchor = el.closest('.cell') ?? el;
    const entry = $catalogLookup.getItem(inv.name, inv.source);
    // Same rule as the inventory row: your own description wins, then the
    // catalog, then an empty one to write for a custom weapon.
    if (entry && !inv.description) openDetail('item', entry, anchor);
    else openCustomEntry('item', inv.name, inv.source, anchor);
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

  // Attacks that aren't a weapon in the pack — a bite, a breath weapon, an
  // improvised chair. Damage is free text: "2d6 + 3 fire" is what people write,
  // and it is rolled when it parses as dice.
  const customs = $derived($character.customAttacks ?? []);
  let newAttack = $state('');
  function addAttack(e: Event) {
    e.preventDefault();
    addCustomAttack(newAttack);
    newAttack = '';
  }

  function rollCustom(a: CustomAttack) {
    const node = customAttackNode(a.id);
    const toHit = $graph.has(node) ? $graph.get(node) : 0;
    const parts = [rollD20(get(diceMode), toHit, 'Attack')];
    const { terms, modifier } = parseDice(a.damage || '');
    if (terms.length) parts.push(rollTerms(terms, modifier, 'Damage'));
    rollParts(a.name, parts);
  }

  // Damage string: dice + the graph-computed bonus (ability mod + magic) + type.
  function damage(id: string, dice: string, type: string): string {
    const bonus = $graph.has(`attack.${id}.dmg`) ? $graph.get(`attack.${id}.dmg`) : 0;
    const sign = bonus > 0 ? `+${bonus}` : bonus < 0 ? `${bonus}` : '';
    return `${dice}${sign}${type ? ` ${type}` : ''}`;
  }
</script>

<section class="block" data-variant={variant}>
  <h3>Attacks</h3>
  {#if attacks.length === 0 && customs.length === 0}
    <p class="empty">Equip a weapon (quick import → inventory → equip) to see attacks here.</p>
  {:else}
    <ul>
      {#each attacks as a (a.id)}
        {@const idx = Number(a.id.slice(1))}
        {@const wic = iconForItem({ name: a.name })}
        <li>
          <div class="row">
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
            disabled={!$canEditBuild}
            title={a.proficient ? 'Proficient' : 'Not proficient'}
            onclick={() => setItemProficient(idx, !a.proficient)}
          >prof</button>
          <button class="roll" title="Roll attack + damage" aria-label="Roll {a.name}" onclick={() => rollAttack(a)}><Icon name="dice" /></button>
          </div>
          <Reminders anchor={anchors.attack(a.name)} />
        </li>
      {/each}
      {#each customs as a (a.id)}
        <li>
          <!-- Its own row: the weapon grid has a fixed six columns, and an
               editable attack has nine things in it. -->
          <div class="row custom">
            <span class="wicon" title="Your own attack"><Icon name="sword" /></span>
            {#if $canEditBuild}
              <input
                class="name edit"
                aria-label="Attack name"
                value={a.name}
                onchange={(e) => updateCustomAttack(a.id, { name: (e.target as HTMLInputElement).value })}
              />
            {:else}
              <span class="name plain">{a.name}</span>
            {/if}
            <span class="hit" title="Attack bonus">
              <StatValue node={customAttackNode(a.id)} signed />
            </span>
            {#if $canEditBuild}
              <select
                class="pick"
                aria-label="{a.name} ability"
                value={a.ability ?? ''}
                onchange={(e) => updateCustomAttack(a.id, { ability: ((e.target as HTMLSelectElement).value || undefined) as CustomAttack['ability'] })}
              >
                <option value="">—</option>
                {#each ABILITIES as ab}<option value={ab}>{ABILITY_NAMES[ab].slice(0, 3)}</option>{/each}
              </select>
              <input
                class="bonus"
                type="number"
                aria-label="{a.name} bonus"
                value={a.bonus ?? 0}
                onchange={(e) => updateCustomAttack(a.id, { bonus: Number((e.target as HTMLInputElement).value) || 0 })}
              />
              <input
                class="dmgedit"
                aria-label="{a.name} damage"
                placeholder="2d6 + 3 fire"
                value={a.damage ?? ''}
                onchange={(e) => updateCustomAttack(a.id, { damage: (e.target as HTMLInputElement).value })}
              />
            {:else}
              <span class="dmg">{a.damage ?? ''}</span>
            {/if}
            <button
              class="prof"
              class:on={a.proficient}
              disabled={!$canEditBuild}
              title={a.proficient ? 'Proficient' : 'Not proficient'}
              onclick={() => updateCustomAttack(a.id, { proficient: !a.proficient })}
            >prof</button>
            <button class="roll" title="Roll attack + damage" aria-label="Roll {a.name}" onclick={() => rollCustom(a)}><Icon name="dice" /></button>
            {#if $canEditBuild}
              <button class="rm" aria-label="Remove {a.name}" onclick={() => removeCustomAttack(a.id)}>×</button>
            {/if}
          </div>
          <Reminders anchor={anchors.attack(a.name)} />
        </li>
      {/each}
    </ul>
  {/if}
  {#if $canEditBuild}
    <form class="quickadd" onsubmit={addAttack}>
      <input placeholder="Add an attack…" aria-label="New attack name" bind:value={newAttack} />
      <button type="submit" disabled={!newAttack.trim()}>+</button>
    </form>
  {/if}
</section>

<style>
  .block { border: 1px solid var(--line); border-radius: 8px; padding: 0.75rem 1rem; }
  h3 { margin: 0 0 0.6rem; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .empty { color: var(--muted); font-size: 0.85rem; margin: 0; }
  /* The player's own attacks use the same row; the editable bits stay small so
     a typed row is the same height as a weapon's. */
  .name.edit, .pick, .bonus, .dmgedit {
    font: inherit;
    font-size: 0.8rem;
    padding: 0.1rem 0.25rem;
    border: 1px solid var(--line);
    border-radius: 4px;
    background: var(--bg);
    color: var(--fg);
    min-width: 0;
  }
  .name.edit { flex: 1; }
  .name.plain { flex: 1; }
  .bonus { width: 3rem; text-align: center; }
  .dmgedit { width: 8rem; }
  .rm { font: inherit; font-size: 0.9rem; line-height: 1; padding: 0 0.2rem; border: none; background: none; color: var(--muted); cursor: pointer; }
  .rm:hover { color: #d2645a; }
  .quickadd { display: flex; gap: 0.35rem; margin-top: 0.5rem; }
  .quickadd input { flex: 1; min-width: 0; font: inherit; font-size: 0.8rem; padding: 0.2rem 0.4rem; border: 1px solid var(--line); border-radius: 6px; background: var(--bg); color: var(--fg); }
  .quickadd button { font: inherit; padding: 0.1rem 0.6rem; border: 1px solid var(--line); border-radius: 6px; background: var(--bg); color: var(--fg); cursor: pointer; }
  .quickadd button:disabled { opacity: 0.4; cursor: default; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { padding: 0.3rem 0; border-bottom: 1px solid var(--line); }
  .row {
    display: grid;
    grid-template-columns: auto 1fr auto auto auto auto;
    align-items: center;
    gap: 0.6rem;
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
  .row.custom { display: flex; flex-wrap: wrap; gap: 0.3rem 0.45rem; }
  .row.custom .name.edit, .row.custom .name.plain { flex: 1 1 5rem; min-width: 4rem; }
  .row.custom .dmgedit { flex: 1 1 6rem; width: auto; min-width: 5rem; }
  .row.custom .hit, .row.custom .prof, .row.custom .roll, .row.custom .rm, .row.custom .pick, .row.custom .bonus { flex: none; }

  /* In a narrow cell the fixed grid can't fit; wrap the stats under the name. */
  @container cell (max-width: 340px) {
    .row { display: flex; flex-wrap: wrap; gap: 0.35rem 0.6rem; }
    .name { flex: 1 1 60%; white-space: normal; overflow-wrap: anywhere; }
  }
</style>
