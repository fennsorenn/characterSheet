import { writable } from 'svelte/store';
import type { ChoiceFilter } from '../character/index.js';

/** Target of the "choose a spell" picker: which choice slot and its filter. */
export interface PickerTarget {
  key: string;
  filter: ChoiceFilter;
  label: string;
}

export const spellPicker = writable<PickerTarget | null>(null);

export function openSpellPicker(target: PickerTarget) {
  spellPicker.set(target);
}
export function closeSpellPicker() {
  spellPicker.set(null);
}
