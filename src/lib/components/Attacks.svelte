<script lang="ts">
  import { character, graph, setItemProficient } from '../stores/character.js';
  import { catalogLookup } from '../stores/catalog.js';
  import {
    weaponAttacks,
    iconForItem,
    iconForDamageType,
    iconLabel,
    ABILITY_NAMES
  } from '../character/index.js';
  import StatValue from './StatValue.svelte';
  import Icon from './Icon.svelte';

  let { variant = 'full' }: { variant?: string } = $props();

  const attacks = $derived(weaponAttacks($character, $catalogLookup));

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
          <span class="name">{a.name}</span>
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
    grid-template-columns: auto 1fr auto auto auto;
    align-items: center;
    gap: 0.6rem;
    padding: 0.3rem 0;
    border-bottom: 1px solid var(--line);
  }
  .wicon { color: var(--muted); display: inline-flex; }
  .wicon :global(.icon) { width: 1.05rem; height: 1.05rem; }
  .name { font-weight: 600; }
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
</style>
