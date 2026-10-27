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
    type InventoryNode,
    type DropPosition
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

  // Dragging runs on pointer events rather than the HTML5 drag API, so one code
  // path covers mouse, touch and pen. That matters here: HTML5 drag does not
  // fire on touch at all, and this sheet is used on a tablet.
  //
  // The gesture starts from a grip rather than the row, because the list is
  // height-capped and scrollable — a touch-drag anywhere else has to stay a
  // scroll. The grip carries `touch-action: none`, which is what stops the
  // browser claiming the gesture before we see it.
  let dragIndex = $state<number | null>(null);
  let dropIndex = $state<number | null>(null);
  let overRoot = $state(false);
  let dropPos = $state<DropPosition>('inside');
  let listEl = $state<HTMLElement | null>(null);

  /** Whether the row being dragged may legally land on the row at `ontoIndex`. */
  function allowedTarget(ontoIndex: number, pos: DropPosition = 'inside'): boolean {
    if (dragIndex === null) return false;
    const from = $character.inventory[dragIndex];
    const onto = $character.inventory[ontoIndex];
    if (!from?.id || !onto?.id) return false;
    if (dragIndex === ontoIndex) return false;
    // Nesting into the container it already sits in is a no-op; reordering
    // beside a sibling is not, so only `inside` is ruled out here.
    if (pos === 'inside' && from.container === onto.id) return false;
    return !containsDeep($character, from.id, onto.id);
  }

  function onGripDown(e: PointerEvent, index: number) {
    // Claim the gesture: without capture the pointer is lost the moment it
    // leaves the grip, which is immediately. Guarded because capture throws
    // when the pointer id is not one the browser is tracking.
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* capture is an optimisation, not a requirement */
    }
    e.preventDefault();
    e.stopPropagation();
    dragIndex = index;
    dropIndex = null;
    overRoot = false;
  }

  function onGripMove(e: PointerEvent) {
    if (dragIndex === null) return;
    e.preventDefault();
    autoScroll(e.clientY);

    // Pointer capture sends every move to the grip, so the row under the
    // finger has to be found by hit-testing rather than by its own events.
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const rowEl = el?.closest<HTMLElement>('[data-inv-index]');
    if (rowEl) {
      const idx = Number(rowEl.dataset.invIndex);
      // Where in the row decides the gesture: the outer quarters place the item
      // beside the target (reorder), the middle half puts it inside.
      const box = rowEl.getBoundingClientRect();
      const ratio = box.height ? (e.clientY - box.top) / box.height : 0.5;
      const pos: DropPosition = ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'inside';
      if (Number.isInteger(idx) && allowedTarget(idx, pos)) {
        dropIndex = idx;
        dropPos = pos;
        overRoot = false;
        return;
      }
      dropIndex = null;
      overRoot = false;
      return;
    }
    // Rows fill the list, so there is no reliable empty background to aim at:
    // the way out of a container is an explicit strip, shown only while
    // dragging something that is in one.
    dropIndex = null;
    overRoot = !!el?.closest('[data-inv-out]');
  }

  function onGripUp() {
    if (dragIndex === null) return;
    if (dropIndex !== null) dropInventoryItem(dragIndex, dropIndex, dropPos);
    else if (overRoot) dropInventoryItem(dragIndex, null);
    endDrag();
  }

  /** Nudge the scroll container when the pointer nears its edge. */
  function autoScroll(clientY: number) {
    const box = listEl?.getBoundingClientRect();
    if (!listEl || !box) return;
    const margin = 36;
    if (clientY < box.top + margin) listEl.scrollTop -= 12;
    else if (clientY > box.bottom - margin) listEl.scrollTop += 12;
  }

  function endDrag() {
    dragIndex = null;
    dropIndex = null;
    overRoot = false;
    dropPos = 'inside';
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
      class:droptarget={dropIndex === i && dropPos === 'inside'}
      class:dropbefore={dropIndex === i && dropPos === 'before'}
      class:dropafter={dropIndex === i && dropPos === 'after'}
      data-inv-index={i}
    >
      {#if $canEditBuild}
        <button
          class="grip"
          aria-label="Drag to move this into a container"
          title="Drag onto another item to put it inside"
          onpointerdown={(e) => onGripDown(e, i)}
          onpointermove={onGripMove}
          onpointerup={onGripUp}
          onpointercancel={endDrag}
        >⠿</button>
      {/if}
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
      bind:this={listEl}
      style={scrollStyle(editing, height)}
      use:resizePersist={{ editing, height, onResize }}
    >
    {#if dragIndex !== null && $character.inventory[dragIndex]?.container}
      <div class="takeout" class:over={overRoot} data-inv-out>Drop here to take out of its container</div>
    {/if}
    <ul>
      {#each tree as node (node.item.id ?? node.item.name + node.item.source)}
        {@render row(node)}
      {/each}
    </ul>
    </div>
  {/if}
  <QuickAdd kind="item" />
</section>

<style>
  .grip {
    background: none;
    border: none;
    padding: 0 0.15rem;
    cursor: grab;
    color: var(--muted, #aaa);
    font-size: 0.9em;
    line-height: 1;
    /* The list scrolls; without this the browser takes the gesture first. */
    touch-action: none;
  }
  .grip:active { cursor: grabbing; }
  .row.dragging { opacity: 0.45; }
  .row.dropbefore { box-shadow: inset 0 2px 0 0 var(--accent, #36c); }
  .row.dropafter { box-shadow: inset 0 -2px 0 0 var(--accent, #36c); }
  .row.droptarget { outline: 2px solid var(--accent, #36c); outline-offset: 1px; border-radius: 4px; }
  .takeout {
    position: sticky;
    top: 0;
    z-index: 2;
    margin-bottom: 0.25rem;
    padding: 0.35rem 0.5rem;
    text-align: center;
    font-size: 0.75rem;
    color: var(--muted, #777);
    border: 1px dashed var(--line, #ccc);
    border-radius: 4px;
    background: var(--bg, #fff);
  }
  .takeout.over { border-color: var(--accent, #36c); color: var(--accent, #36c); border-style: solid; }
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
