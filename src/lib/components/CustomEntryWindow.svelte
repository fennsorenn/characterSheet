<script lang="ts">
  import { character, setItemDescription, setSpellDescription } from '../stores/character.js';
  import { customEntry, closeCustomEntry } from '../stores/customEntry.js';
  import FloatingWindow from './FloatingWindow.svelte';

  /**
   * The description of an item or spell the catalog doesn't know — anything
   * added by typing a name rather than picking a search hit. There is no
   * reference text to show for those, so the window shows the player's own
   * instead, editable in place like the rest of the sheet.
   */
  const target = $derived($customEntry);

  const index = $derived.by(() => {
    if (!target) return -1;
    const list = target.kind === 'item' ? $character.inventory : $character.spells;
    return list.findIndex((e) => e.name === target.name && e.source === target.source);
  });
  const entry = $derived(
    index < 0 || !target
      ? undefined
      : target.kind === 'item'
        ? $character.inventory[index]
        : $character.spells[index]
  );

  let area = $state<HTMLTextAreaElement | null>(null);
  let wasOpen = false;

  $effect(() => {
    if (target && !wasOpen) area?.focus();
    wasOpen = !!target;
    // The entry can be removed from the list while its window is open.
    if (target && index < 0) closeCustomEntry();
  });

  function save(text: string) {
    if (index < 0 || !target) return;
    if (target.kind === 'item') setItemDescription(index, text);
    else setSpellDescription(index, text);
  }
</script>

{#if target && entry}
  <FloatingWindow
    anchor={target.anchor}
    width={360}
    height={320}
    label="{target.kind === 'item' ? 'Item' : 'Spell'}: {entry.name}"
    onClose={closeCustomEntry}
  >
    {#snippet header()}
      <span class="title">{('label' in entry && entry.label) || entry.name}</span>
    {/snippet}
    {#snippet children()}
      <p class="where">{target.kind === 'item' ? 'Item' : 'Spell'} · {entry.source}</p>
      <textarea
        bind:this={area}
        class="body"
        placeholder={target.kind === 'item'
          ? 'What it is and what it does — the rules text you would otherwise look up.'
          : 'Casting time, range, components, duration, and what the spell does.'}
        aria-label="Description"
        value={entry.description ?? ''}
        onchange={(e) => save((e.target as HTMLTextAreaElement).value)}
      ></textarea>
    {/snippet}
  </FloatingWindow>
{/if}

<style>
  .title {
    flex: 1;
    min-width: 0;
    font-weight: 600;
    color: var(--fg);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .where {
    margin: 0;
    padding: 0.3rem 0.6rem 0;
    font-size: 0.72rem;
    color: var(--muted);
  }
  .body {
    font: inherit;
    font-size: 0.85rem;
    line-height: 1.45;
    margin: 0.35rem 0.6rem 0.6rem;
    min-height: 13rem;
    resize: vertical;
    color: var(--fg);
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 0.4rem 0.5rem;
  }
  .body:focus { outline: none; border-color: var(--accent); }
</style>
