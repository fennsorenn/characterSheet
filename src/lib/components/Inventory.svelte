<script lang="ts">
  import {
    character,
    toggleEquipped,
    setItemQuantity,
    removeInventoryItem
  } from '../stores/character.js';
  import { catalogLookup } from '../stores/catalog.js';
  import NumberField from './NumberField.svelte';

  // Show a short note about an item's mechanical effect, so it's clear why
  // equipping it changed AC/saves. Resolved live from the catalog.
  function effectNote(name: string, source: string): string {
    const item = $catalogLookup.getItem(name, source);
    if (!item) return '';
    const notes: string[] = [];
    const type = typeof item.type === 'string' ? item.type.split('|')[0] : '';
    if (type === 'LA' || type === 'MA' || type === 'HA') notes.push(`armor ${item.ac}`);
    if (type === 'S') notes.push(`shield +${item.ac ?? 2}`);
    if (item.bonusAc) notes.push(`AC ${item.bonusAc}`);
    if (item.bonusSavingThrow) notes.push(`saves ${item.bonusSavingThrow}`);
    if (item.bonusSpellAttack) notes.push(`spell atk ${item.bonusSpellAttack}`);
    if (item.bonusSpellSaveDc) notes.push(`spell DC ${item.bonusSpellSaveDc}`);
    return notes.join(' · ');
  }
</script>

<section class="block">
  <h3>Inventory</h3>
  {#if $character.inventory.length === 0}
    <p class="empty">Nothing yet — use quick import above to add items. Equip armor to see AC update.</p>
  {:else}
    <ul>
      {#each $character.inventory as item, i (item.name + item.source)}
        {@const note = effectNote(item.name, item.source)}
        <li>
          <label class="equip" title="Equip / attune">
            <input type="checkbox" checked={item.equipped} onchange={() => toggleEquipped(i)} />
          </label>
          <span class="qty">
            <NumberField value={item.quantity} min={0} onchange={(v) => setItemQuantity(i, v)} />
          </span>
          <span class="name" class:equipped={item.equipped}>{item.name}</span>
          <span class="src">{item.source}</span>
          {#if note}<span class="note">{note}</span>{/if}
          <button class="rm" aria-label="Remove" onclick={() => removeInventoryItem(i)}>×</button>
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
  li { display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0; border-bottom: 1px solid var(--line); }
  .qty { width: 2.5ch; }
  .name { flex: 1; }
  .name.equipped { font-weight: 600; }
  .src { font-size: 0.7rem; text-transform: uppercase; color: var(--muted); }
  .note { font-size: 0.75rem; color: var(--accent); }
  .rm { background: none; border: none; color: var(--muted); font-size: 1.1rem; cursor: pointer; line-height: 1; }
  .rm:hover { color: var(--accent); }
</style>
