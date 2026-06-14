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
