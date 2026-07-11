<script lang="ts">
  import {
    character,
    toggleEquipped,
    toggleAttuned,
    setItemQuantity,
    removeInventoryItem,
    renameInventoryItem
  } from '../stores/character.js';
  import { catalogLookup } from '../stores/catalog.js';
  import { openDetail } from '../stores/detail.js';
  import { ATTUNEMENT_LIMIT, iconForItem, iconLabel } from '../character/index.js';
  import NumberField from './NumberField.svelte';
  import Icon from './Icon.svelte';
  import QuickAdd from './QuickAdd.svelte';
  import { scrollStyle, resizePersist } from './scrollCell.js';

  let {
    variant = 'full',
    height = undefined,
    editing = false,
    onResize = undefined
  }: {
    variant?: string;
    height?: number;
    editing?: boolean;
    onResize?: (h: number) => void;
  } = $props();

  // Inline rename: which row is being edited and its working text.
  let editingIndex = $state<number | null>(null);
  let editValue = $state('');

  function startRename(index: number, current: string) {
    editingIndex = index;
    editValue = current;
  }
  function commitRename() {
    if (editingIndex !== null) renameInventoryItem(editingIndex, editValue);
    editingIndex = null;
  }
  function onRenameKey(e: KeyboardEvent) {
    if (e.key === 'Enter') commitRename();
    else if (e.key === 'Escape') editingIndex = null;
  }

  const attunedCount = $derived($character.inventory.filter((i) => i.attuned).length);
  const needsAttune = (name: string, source: string) =>
    !!$catalogLookup.getItem(name, source)?.reqAttune;

  function openItemDetail(name: string, source: string, el: Element) {
    const entry = $catalogLookup.getItem(name, source);
    // Anchor to the whole block so the window opens beside the list, not over it.
    if (entry) openDetail('item', entry, el.closest('.cell') ?? el);
  }

  // Icon for an item — uses the catalog entry's type/dmgType when available,
  // otherwise resolves from the name alone.
  const iconFor = (name: string, source: string) =>
    iconForItem($catalogLookup.getItem(name, source) ?? { name });

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

<section class="block" data-variant={variant}>
  <header class="head">
    <h3>Inventory</h3>
    <span class="attune-count" class:full={attunedCount >= ATTUNEMENT_LIMIT}>
      Attuned {attunedCount}/{ATTUNEMENT_LIMIT}
    </span>
  </header>
  {#if $character.inventory.length === 0}
    <p class="empty">Nothing yet — add items with quick add below. Equip armor to see AC update.</p>
  {:else}
    <div
      class="listscroll"
      style={scrollStyle(editing, height)}
      use:resizePersist={{ editing, height, onResize }}
    >
    <ul>
      {#each $character.inventory as item, i (item.name + item.source)}
        {@const note = effectNote(item.name, item.source)}
        {@const ic = iconFor(item.name, item.source)}
        <li>
          <label class="equip" title="Equipped">
            <input type="checkbox" checked={item.equipped} onchange={() => toggleEquipped(i)} />
          </label>
          <span class="qty">
            <NumberField value={item.quantity} min={0} onchange={(v) => setItemQuantity(i, v)} />
          </span>
          <span class="itemicon" title={iconLabel(ic)}><Icon name={ic} /></span>
          {#if editingIndex === i}
            <!-- svelte-ignore a11y_autofocus -->
            <input
              class="rename"
              autofocus
              bind:value={editValue}
              onkeydown={onRenameKey}
              onblur={commitRename}
            />
          {:else}
            <button class="name" class:equipped={item.equipped} title="Show details" onclick={(e) => openItemDetail(item.name, item.source, e.currentTarget)}>{item.label ?? item.name}</button>
            <button class="edit" title="Rename item" aria-label="Rename item" onclick={() => startRename(i, item.label ?? item.name)}>✎</button>
          {/if}
          {#if needsAttune(item.name, item.source)}
            <button
              class="attune"
              class:on={item.attuned}
              disabled={!item.attuned && attunedCount >= ATTUNEMENT_LIMIT}
              title={item.attuned ? 'Attuned' : 'Attune'}
              onclick={() => toggleAttuned(i)}
            >★</button>
          {/if}
          <span class="src">{item.source}</span>
          {#if note}<span class="note">{note}</span>{/if}
          <button class="rm" aria-label="Remove" onclick={() => removeInventoryItem(i)}>×</button>
        </li>
      {/each}
    </ul>
    </div>
  {/if}
  <QuickAdd kind="item" />
</section>

<style>
  .block { border: 1px solid var(--line); border-radius: 8px; padding: 0.75rem 1rem; }
  .head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 0.6rem; }
  h3 { margin: 0; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .attune-count { font-size: 0.7rem; color: var(--muted); }
  .attune-count.full { color: var(--accent); }
  .attune {
    font: inherit; font-size: 0.8rem; line-height: 1;
    padding: 0.1rem 0.3rem;
    border: 1px solid var(--line); border-radius: 4px;
    background: var(--bg); color: var(--muted); cursor: pointer;
  }
  .attune.on { background: var(--accent); border-color: var(--accent); color: #fff; }
  .attune:disabled { opacity: 0.35; cursor: not-allowed; }
  .empty { color: var(--muted); font-size: 0.85rem; margin: 0; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem 0.5rem; padding: 0.25rem 0; border-bottom: 1px solid var(--line); }
  .qty { width: 2.5ch; flex: none; }
  .itemicon { color: var(--muted); display: inline-flex; flex: none; }
  .itemicon :global(.icon) { width: 1.05rem; height: 1.05rem; }
  .name { flex: 1; min-width: 6ch; text-align: left; background: none; border: none; padding: 0; color: var(--fg); font: inherit; cursor: pointer; overflow-wrap: anywhere; }
  .name:hover { color: var(--accent); }
  .name.equipped { font-weight: 600; }
  /* Rename affordance: hidden until the row is hovered/focused, keeping the row clean. */
  .edit {
    flex: none;
    font: inherit; font-size: 0.8rem; line-height: 1;
    padding: 0.1rem 0.3rem;
    border: none; background: none; color: var(--muted);
    cursor: pointer; opacity: 0; transition: opacity 0.12s;
  }
  li:hover .edit, .edit:focus-visible { opacity: 1; }
  .edit:hover { color: var(--accent); }
  .rename {
    flex: 1; min-width: 6ch;
    font: inherit; padding: 0.1rem 0.35rem;
    border: 1px solid var(--accent); border-radius: 4px;
    background: var(--bg); color: var(--fg);
  }
  .src { font-size: 0.7rem; text-transform: uppercase; color: var(--muted); }
  .note { font-size: 0.75rem; color: var(--accent); }
  .rm { background: none; border: none; color: var(--muted); font-size: 1.1rem; cursor: pointer; line-height: 1; }
  .rm:hover { color: var(--accent); }
</style>
