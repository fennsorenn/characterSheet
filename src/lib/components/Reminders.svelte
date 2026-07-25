<script lang="ts">
  import { character, addReminder, setReminderText, removeReminder, moveReminder } from '../stores/character.js';
  import { reminderMode, registerAnchor } from '../stores/reminders.js';
  import { remindersAt } from '../character/index.js';

  /**
   * The notes pinned at one anchor — a skill row, an item, a whole block. Sits
   * directly under whatever it annotates, so it survives any reflow: the sheet
   * can change template or drop to one column and the note is still under
   * Stealth.
   *
   * Read-only until reminder mode is on, when each note becomes editable and an
   * "add" affordance appears. Hosts render this unconditionally; it takes no
   * space when there is nothing to show.
   */
  let { anchor, what = 'note' }: { anchor: string; what?: string } = $props();

  // Registering while mounted is what lets the sheet find stranded reminders.
  $effect(() => registerAnchor(anchor));

  const list = $derived(remindersAt($character.reminders, anchor));

  let adding = $state(false);
  let draft = $state('');
  let input = $state<HTMLInputElement | null>(null);

  function open() {
    adding = true;
    draft = '';
  }

  function commit() {
    addReminder(anchor, draft);
    draft = '';
    adding = false;
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter') commit();
    else if (e.key === 'Escape') {
      adding = false;
      draft = '';
    }
  }

  // Focus the field as soon as it appears, so adding a note is one click + type.
  $effect(() => {
    if (adding) input?.focus();
  });
</script>

{#if list.length || $reminderMode}
  <div class="reminders" class:editing={$reminderMode}>
    {#each list as r, i (r.id)}
      <div class="reminder">
        {#if $reminderMode}
          <input
            class="text"
            value={r.text}
            aria-label="Reminder"
            onchange={(e) => setReminderText(r.id, (e.target as HTMLInputElement).value)}
          />
          <button class="mini" title="Move up" disabled={i === 0} onclick={() => moveReminder(r.id, -1)}>↑</button>
          <button class="mini" title="Move down" disabled={i === list.length - 1} onclick={() => moveReminder(r.id, 1)}>↓</button>
          <button class="mini danger" title="Delete reminder" onclick={() => removeReminder(r.id)}>✕</button>
        {:else}
          <span class="text">{r.text}</span>
        {/if}
      </div>
    {/each}

    {#if $reminderMode}
      {#if adding}
        <div class="reminder">
          <input
            bind:this={input}
            class="text"
            placeholder="Reminder…"
            aria-label="New reminder"
            bind:value={draft}
            onkeydown={onKey}
            onblur={commit}
          />
        </div>
      {:else}
        <button class="add" onclick={open}>+ {what}</button>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .reminders {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    font-size: 0.75rem;
    line-height: 1.35;
  }
  .reminder { display: flex; align-items: center; gap: 0.2rem; }
  /* A hanging mark so a note reads as an annotation, not another data row. */
  .reminder .text::before { content: '↳'; margin-right: 0.3rem; color: var(--line); }
  span.text { color: var(--muted); font-style: italic; min-width: 0; overflow-wrap: anywhere; }

  input.text {
    flex: 1;
    min-width: 0;
    font: inherit;
    font-style: italic;
    color: var(--muted);
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 0.05rem 0.3rem;
  }
  input.text:focus { outline: none; border-color: var(--accent); color: var(--fg); }

  .mini, .add {
    font: inherit;
    font-size: 0.7rem;
    line-height: 1;
    padding: 0.15rem 0.3rem;
    border: 1px solid transparent;
    background: none;
    color: var(--muted);
    border-radius: 4px;
    cursor: pointer;
    flex: none;
  }
  .mini:hover, .add:hover { border-color: var(--line); color: var(--fg); }
  .mini:disabled { opacity: 0.3; cursor: not-allowed; }
  .danger:hover { border-color: var(--accent); color: var(--accent); }
  .add { align-self: flex-start; border-style: dashed; border-color: var(--line); }
</style>
