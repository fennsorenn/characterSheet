import { writable, derived } from 'svelte/store';
import { character } from './character.js';
import { strandedReminders } from '../character/index.js';

/**
 * Reminder mode: while on, every spot that can take a pinned note shows a place
 * to add one, and existing notes become editable. Off, they are just small
 * margin notes on the sheet (and print that way).
 */
export const reminderMode = writable(false);
export const toggleReminderMode = () => reminderMode.update((v) => !v);

/**
 * Anchors currently on screen, ref-counted because a template may place the same
 * block twice. Every <Reminders> instance registers while it is mounted, which
 * is how the sheet knows a reminder has been stranded — its row gone from the
 * layout, its item sold — and can offer to clear it up. Without this a stranded
 * note is invisible and impossible to delete.
 */
const counts = writable(new Map<string, number>());

export function registerAnchor(anchor: string): () => void {
  counts.update((m) => new Map(m).set(anchor, (m.get(anchor) ?? 0) + 1));
  return () =>
    counts.update((m) => {
      const next = new Map(m);
      const n = (next.get(anchor) ?? 1) - 1;
      if (n > 0) next.set(anchor, n);
      else next.delete(anchor);
      return next;
    });
}

/** Reminders whose anchor is not rendered anywhere on the current sheet. */
export const stranded = derived([character, counts], ([$c, $counts]) =>
  strandedReminders($c.reminders, $counts.keys())
);
