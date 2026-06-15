import { writable } from 'svelte/store';

/** Which calc node, if any, is currently open in the "explain this number" popover. */
export interface ExplainTarget {
  id: string;
  label: string;
}

export const explainTarget = writable<ExplainTarget | null>(null);

export function openExplain(id: string, label: string) {
  explainTarget.set({ id, label });
}

export function closeExplain() {
  explainTarget.set(null);
}

/**
 * Buff mode: when on, editing a value applies a temporary modifier on its calc
 * node (a buff or debuff) instead of changing the underlying base value. Because
 * the calc graph layers modifiers on every node, this works for computed values
 * (AC, saves) just as well as for base ones (ability scores).
 */
export const buffMode = writable(false);

export function toggleBuffMode() {
  buffMode.update((v) => !v);
}

