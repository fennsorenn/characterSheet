<script lang="ts">
  import { canEditBuild, canEditPlay } from '../stores/mode.js';
  import {
    character,
    toggleEquipped,
    toggleAttuned,
    setItemQuantity,
    removeInventoryItem,
    renameInventoryItem,
    toggleContainer,
    dropInventoryItem
  } from '../stores/character.js';
  import { catalogLookup } from '../stores/catalog.js';
  import { openDetail } from '../stores/detail.js';
  import { openCustomEntry } from '../stores/customEntry.js';
  import { ATTUNEMENT_LIMIT, iconForItem, iconLabel } from '../character/index.js';
  import NumberField from './NumberField.svelte';
  import Reminders from './Reminders.svelte';
  import { anchors } from '../character/index.js';
  import Icon from './Icon.svelte';
  import UiIcon from './UiIcon.svelte';
  import QuickAdd from './QuickAdd.svelte';
  import { scrollStyle, resizePersist } from './scrollCell.js';
  import { defaultOptions } from '../layout/blocks.js';
  import {
    inventoryTree,
    containerOpen,
    contentsCount,
    containsDeep,
    type InventoryNode
  } from '../character/inventory.js';
  import CoinFields from './CoinFields.svelte';

  let {
    variant = 'full',
    height = undefined,
    editing = false,
    onResize = undefined,
    options = {}
  }: {
    variant?: string;
    height?: number;
    editing?: boolean;
    onResize?: (h: number) => void;
    options?: Record<string, boolean>;
  } = $props();

  // The currency row is an option, not a variant: it is one line item, and the
  // standalone Currency block is this same row placed on its own.
  const on = $derived({ ...defaultOptions('inventory', variant), ...options });

  // Containment is a parent pointer on a flat array; the tree is built only
  // for rendering, and every node carries its original index so the actions
  // below stay index-based exactly as before.
  const tree = $derived(inventoryTree($character));

  // Drag and drop uses the native HTML5 API, the same mechanism the layout
  // renderer uses for reordering blocks. Dropping a row onto another is the
  // only way to nest, and the only way to create a container.
  let dragIndex = $state<number | null>(null);
  let dropIndex = $state<number | null>(null);
  let overRoot = $state(false);

  /** Whether the row being dragged may legally land on `node`. */
  function canDrop(node: InventoryNode): boolean {
    if (dragIndex === null) return false;
    const from = $character.inventory[dragIndex];
    const onto = node.item;
    if (!from?.id || !onto.id) return false;
    if (dragIndex === node.index) return false;
    if (from.container === onto.id) return false;
    // Refuse to put a bag inside something it already holds.
    return !containsDeep($character, from.id, onto.id);
  }

  function onRowDragStart(e: DragEvent, index: number) {
    // The block itself is draggable in layout edit mode; keep this drag here.
    e.stopPropagation();
    dragIndex = index;
    e.dataTransfer?.setData('text/plain', String(index));
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }

  function onRowDragOver(e: DragEvent, node: InventoryNode) {
    if (!canDrop(node)) return;
    e.preventDefault();
    e.stopPropagation();
    dropIndex = node.index;
    overRoot = false;
  }

  function onRowDrop(e: DragEvent, node: InventoryNode) {
    if (!canDrop(node)) return;
    e.preventDefault();
    e.stopPropagation();
    dropInventoryItem(dragIndex!, node.index);
    endDrag();
  }

  /** The list background: dropping here takes a row back out of its container. */
  function onRootDragOver(e: DragEvent) {
    if (dragIndex === null) return;
    if (!$character.inventory[dragIndex]?.container) return;
    e.preventDefault();
    dropIndex = null;
    overRoot = true;
  }

  function onRootDrop(e: DragEvent) {
    if (dragIndex === null || !overRoot) return;
    e.preventDefault();
    dropInventoryItem(dragIndex, null);
    endDrag();
  }

  function endDrag() {
    dragIndex = null;
    dropIndex = null;
    overRoot = false;
  }

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

  /**
   * Open what there is to read about an item. A description you wrote wins, so
   * your own text is never hidden behind catalog content; failing that the
   * catalog entry; and for anything the catalog doesn't know — a custom item —
   * an empty description to write.
   */
  function openItemDetail(item: { name: string; source: string; description?: string }, el: Element) {
    const anchor = el.closest('.cell') ?? el;
    const entry = $catalogLookup.getItem(item.name, item.source);
    if (entry && !item.description) openDetail('item', entry, anchor);
    else openCustomEntry('item', item.name, item.source, anchor);
  }

  const readable = (item: { name: string; source: string; description?: string }) =>
    !!item.description || !!$catalogLookup.getItem(item.name, item.source);

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


{#snippet row(node: InventoryNode)}
  {@const item = node.item}
  {@const i = node.index}
  {@const note = effectNote(item.name, item.source)}
  {@const ic = iconFor(item.name, item.source)}
  {@const open = item.id ? containerOpen($character, item.id) : true}
  <li class:is-container={item.isContainer}>
    <div
      class="row"
      class:dragging={dragIndex === i}
      class:droptarget={dropIndex === i}
      draggable={$canEditBuild && editingIndex !== i}
      ondragstart={(e) => onRowDragStart(e, i)}
      ondragover={(e) => onRowDragOver(e, node)}
      ondrop={(e) => onRowDrop(e, node)}
      ondragend={endDrag}
      role="group"
    >
      {#if item.isContainer && item.id}
        <button
          class="disclose"
          aria-expanded={open}
          title={open ? 'Collapse' : 'Expand'}
          onclick={() => toggleContainer(item.id!)}
        >{open ? '▾' : '▸'}</button>
      {:else}
        <span class="disclose spacer" aria-hidden="true"></span>
      {/if}
      <label class="equip" title="Equipped">
        <input type="checkbox" checked={item.equipped} disabled={!$canEditPlay} onchange={() => toggleEquipped(i)} />
      </label>
      <span class="qty">
        <NumberField value={item.quantity} min={0} onchange={(v) => setItemQuantity(i, v)} digits={3} />
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
        <button
          class="name"
          class:equipped={item.equipped}
          title={readable(item) ? 'Show details' : 'Describe this item'}
          onclick={(e) => openItemDetail(item, e.currentTarget)}
        >{item.label ?? item.name}</button>
        {#if item.isContainer}
          <span class="count">{contentsCount(node)}</span>
        {/if}
        {#if $canEditBuild}
          <button class="edit" title="Rename item" aria-label="Rename item" onclick={() => startRename(i, item.label ?? item.name)}><UiIcon name="pencil" size="0.85em" /></button>
        {/if}
      {/if}
      {#if needsAttune(item.name, item.source)}
        <button
          class="attune"
          class:on={item.attuned}
          disabled={!$canEditPlay || (!item.attuned && attunedCount >= ATTUNEMENT_LIMIT)}
          title={item.attuned ? 'Attuned' : 'Attune'}
          onclick={() => toggleAttuned(i)}
        ><UiIcon name="star" filled={item.attuned} size="0.9em" /></button>
      {/if}
      <span class="src">{item.source}</span>
      {#if note}<span class="note">{note}</span>{/if}
      {#if $canEditBuild}
        <button class="rm" aria-label="Remove" onclick={() => removeInventoryItem(i)}>×</button>
      {/if}
    </div>
    <Reminders anchor={anchors.item(item)} />
    {#if node.children.length > 0 && open}
      <ul class="contents">
        {#each node.children as child (child.item.id ?? child.item.name + child.item.source)}
          {@render row(child)}
        {/each}
      </ul>
    {/if}
  </li>
{/snippet}

<section class="block" data-variant={variant}>
  <header class="head">
    <h3>Inventory</h3>
    <span class="attune-count" class:full={attunedCount >= ATTUNEMENT_LIMIT}>
      Attuned {attunedCount}/{ATTUNEMENT_LIMIT}
    </span>
  </header>
  {#if on.currency}
    <div class="currency-row"><CoinFields /></div>
  {/if}
  {#if $character.inventory.length === 0}
    <p class="empty">Nothing yet — add items with quick add below. Equip armor to see AC update.</p>
  {:else}
    <div
      class="listscroll"
      style={scrollStyle(editing, height)}
      use:resizePersist={{ editing, height, onResize }}
    >
    <ul
      class:rootdrop={overRoot}
      ondragover={onRootDragOver}
      ondrop={onRootDrop}
      role="list"
    >
      {#each tree as node (node.item.id ?? node.item.name + node.item.source)}
        {@render row(node)}
      {/each}
    </ul>
    </div>
  {/if}
  <QuickAdd kind="item" />
</section>

<style>
  .row[draggable='true'] { cursor: grab; }
  .row.dragging { opacity: 0.45; }
  .row.droptarget { outline: 2px solid var(--accent, #36c); outline-offset: 1px; border-radius: 4px; }
  ul.rootdrop { outline: 2px dashed var(--accent, #36c); outline-offset: 2px; border-radius: 4px; }
  .contents { list-style: none; margin: 0; padding: 0 0 0 1.1rem; border-left: 1px solid var(--line, #e5e5e5); }
  .disclose { background: none; border: none; cursor: pointer; padding: 0; width: 1em; color: var(--muted, #777); font-size: 0.8em; }
  .disclose.spacer { cursor: default; }
  li.is-container > .row .name { font-weight: 600; }
  .count { font-size: 0.7rem; color: var(--muted, #777); background: var(--chip, #eee); border-radius: 999px; padding: 0 0.35em; }
  .currency-row { padding: 0.15rem 0 0.35rem; border-bottom: 1px solid var(--line, #e5e5e5); margin-bottom: 0.35rem; }
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
  li { padding: 0.25rem 0; border-bottom: 1px solid var(--line); }
  .row { display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem 0.5rem; }
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
