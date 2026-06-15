import { writable } from 'svelte/store';

/** Target of the feat picker: which ASI-or-feat slot is being filled. */
export interface FeatPickerTarget {
  key: string;
  label: string;
}

export const featPicker = writable<FeatPickerTarget | null>(null);

export function openFeatPicker(target: FeatPickerTarget) {
  featPicker.set(target);
}
export function closeFeatPicker() {
  featPicker.set(null);
}
