<script lang="ts">
  import { character, setReminderDetail, setReminderText } from '../stores/character.js';
  import { openExplanation, closeReminderWindow } from '../stores/reminders.js';
  import { anchorLabel } from '../character/index.js';
  import { placeWindow, createDrag } from './windowShell.js';

  /**
   * The longer explanation behind a pinned reminder, in a small floating window
   * beside whatever opened it. Always editable — like every other value on the
   * sheet, there is no separate "edit" state to enter — and saved as you type
   * out of the field.
   */
  const WIDTH = 340;
  const HEIGHT = 300;

  const target = $derived($openExplanation);
  const reminder = $derived($character.reminders?.find((r) => r.id === target?.id));

  let pos = $state({ x: 0, y: 0 });
  let wasOpen = false;
  let area = $state<HTMLTextAreaElement | null>(null);

  // Place it once per opening, then leave it wherever the user drags it.
  $effect(() => {
    if (target && !wasOpen) {
      pos = placeWindow(target.anchor, { width: WIDTH, height: HEIGHT }, {
        width: window.innerWidth,
        height: window.innerHeight
      });
      area?.focus();
    }
    wasOpen = !!target;
  });

  // The reminder can be deleted while its window is open; don't leave a ghost.
  $effect(() => {
    if (target && !reminder) closeReminderWindow();
  });

  const drag = createDrag(
    () => pos,
    (p) => (pos = p)
  );
</script>

{#if target && reminder}
  <div
    class="win"
    style="left:{pos.x}px; top:{pos.y}px; width:{WIDTH}px;"
    role="dialog"
    aria-label="Reminder: {reminder.text}"
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <header class="bar" onpointerdown={drag.down} onpointermove={drag.move} onpointerup={drag.up}>
      <input
        class="title"
        value={reminder.text}
        aria-label="Reminder"
        title="The one-liner shown on the sheet"
        onchange={(e) => setReminderText(reminder.id, (e.target as HTMLInputElement).value)}
      />
      <button class="ic" title="Close" aria-label="Close" onclick={closeReminderWindow}>×</button>
    </header>
    <p class="where">at {anchorLabel(reminder.anchor)}</p>
    <textarea
      bind:this={area}
      class="body"
      placeholder="The longer version — why, when it applies, what to check…"
      aria-label="Explanation"
      value={reminder.detail ?? ''}
      onchange={(e) => setReminderDetail(reminder.id, (e.target as HTMLTextAreaElement).value)}
    ></textarea>
  </div>
{/if}

<style>
  .win {
    position: fixed;
    z-index: 60;
    display: flex;
    flex-direction: column;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 10px;
    box-shadow: 0 10px 30px rgb(0 0 0 / 0.18);
    overflow: hidden;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.4rem 0.35rem 0.6rem;
    border-bottom: 1px solid var(--line);
    background: var(--field-hover);
    cursor: grab;
    touch-action: none;
  }
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
  .ic {
    flex: none;
    font: inherit;
    line-height: 1;
    padding: 0.15rem 0.4rem;
    border: none;
    background: none;
    color: var(--muted);
    border-radius: 5px;
    cursor: pointer;
  }
  .ic:hover { color: var(--accent); }
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
