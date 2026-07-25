<script lang="ts">
  import { character, setReminderDetail, setReminderText } from '../stores/character.js';
  import { openExplanation, closeReminderWindow } from '../stores/reminders.js';
  import { anchorLabel } from '../character/index.js';
  import FloatingWindow from './FloatingWindow.svelte';

  /**
   * The longer explanation behind a pinned reminder, in a small floating window
   * beside whatever opened it. Always editable — like every other value on the
   * sheet, there is no separate "edit" state to enter — and saved as you type
   * out of the field.
   */
  const target = $derived($openExplanation);
  const reminder = $derived($character.reminders?.find((r) => r.id === target?.id));

  let area = $state<HTMLTextAreaElement | null>(null);
  let wasOpen = false;

  $effect(() => {
    if (target && !wasOpen) area?.focus();
    wasOpen = !!target;
    // The reminder can be deleted while its window is open; don't leave a ghost.
    if (target && !reminder) closeReminderWindow();
  });
</script>

{#if target && reminder}
  <FloatingWindow
    anchor={target.anchor}
    width={340}
    height={300}
    label="Reminder: {reminder.text}"
    onClose={closeReminderWindow}
  >
    {#snippet header()}
      <input
        class="title"
        value={reminder.text}
        aria-label="Reminder"
        title="The one-liner shown on the sheet"
        onchange={(e) => setReminderText(reminder.id, (e.target as HTMLInputElement).value)}
      />
    {/snippet}
    {#snippet children()}
      <p class="where">at {anchorLabel(reminder.anchor)}</p>
      <textarea
        bind:this={area}
        class="body"
        placeholder="The longer version — why, when it applies, what to check…"
        aria-label="Explanation"
        value={reminder.detail ?? ''}
        onchange={(e) => setReminderDetail(reminder.id, (e.target as HTMLTextAreaElement).value)}
      ></textarea>
    {/snippet}
  </FloatingWindow>
{/if}

<style>
  .title {
    flex: 1;
    min-width: 0;
    font: inherit;
    font-weight: 600;
    color: var(--fg);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    padding: 0.1rem 0.25rem;
  }
  .title:hover { border-color: var(--line); }
  .title:focus { outline: none; border-color: var(--accent); background: var(--bg); }
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
    min-height: 12rem;
    resize: vertical;
    color: var(--fg);
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 0.4rem 0.5rem;
  }
  .body:focus { outline: none; border-color: var(--accent); }
</style>
