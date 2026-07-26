<script lang="ts">
  import {
    character,
    setItemDescription,
    setSpellDescription,
    setFeatureDescription
  } from '../stores/character.js';
  import { customEntry, closeCustomEntry } from '../stores/customEntry.js';
  import { featureMetaKey } from '../character/index.js';
  import FloatingWindow from './FloatingWindow.svelte';

  /**
   * The description of an item, spell or feature the catalog doesn't know —
   * anything added by typing a name rather than picking a search hit. There is
   * no reference text to show for those, so the window shows the player's own
   * instead, editable in place like the rest of the sheet.
   *
   * A feature's description lives in `featureMeta` with its other overrides; an
   * item's or spell's lives on the entry itself. Either way this window is the
   * one place it is written.
   */
  const target = $derived($customEntry);

  const index = $derived.by(() => {
    if (!target || target.kind === 'feature') return -1;
    const list = target.kind === 'item' ? $character.inventory : $character.spells;
    return list.findIndex((e) => e.name === target.name && e.source === target.source);
  });

  /** What the window shows: a display name and the description to edit. */
  const entry = $derived.by(() => {
    if (!target) return undefined;
    if (target.kind === 'feature') {
      const key = featureMetaKey({ name: target.name, source: target.source });
      return { label: target.name, description: $character.featureMeta[key]?.description };
    }
    const found = target.kind === 'item' ? $character.inventory[index] : $character.spells[index];
    if (!found) return undefined;
    return {
      label: ('label' in found && found.label) || found.name,
      description: found.description
    };
  });

  const KIND_LABEL = { item: 'Item', spell: 'Spell', feature: 'Feature' } as const;
  const PLACEHOLDER = {
    item: 'What it is and what it does — the rules text you would otherwise look up.',
    spell: 'Casting time, range, components, duration, and what the spell does.',
    feature: 'What the feature does, when it applies, and how often you can use it.'
  } as const;

  let area = $state<HTMLTextAreaElement | null>(null);
  let wasOpen = false;

  $effect(() => {
    if (target && !wasOpen) area?.focus();
    wasOpen = !!target;
    // The entry can be removed from the list while its window is open.
    if (target && !entry) closeCustomEntry();
  });

  function save(text: string) {
    if (!target) return;
    if (target.kind === 'feature') {
      setFeatureDescription(featureMetaKey({ name: target.name, source: target.source }), text);
    } else if (index < 0) {
      return;
    } else if (target.kind === 'item') {
      setItemDescription(index, text);
    } else {
      setSpellDescription(index, text);
    }
  }
</script>

{#if target && entry}
  <FloatingWindow
    anchor={target.anchor}
    width={360}
    height={320}
    label="{KIND_LABEL[target.kind]}: {entry.label}"
    onClose={closeCustomEntry}
  >
    {#snippet header()}
      <span class="title">{entry.label}</span>
    {/snippet}
    {#snippet children()}
      <p class="where">{KIND_LABEL[target.kind]} · {target.source}</p>
      <textarea
        bind:this={area}
        class="body"
        placeholder={PLACEHOLDER[target.kind]}
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
