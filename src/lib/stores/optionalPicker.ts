import { writable } from 'svelte/store';

/** Target of the "choose an optional feature" picker: which slot and its types. */
export interface OptionalPickerTarget {
  key: string;
  /** featureType codes this slot accepts (e.g. ['MV:B'] for maneuvers). */
  types: string[];
  label: string;
}

export const optionalPicker = writable<OptionalPickerTarget | null>(null);

export function openOptionalPicker(target: OptionalPickerTarget) {
  optionalPicker.set(target);
}
export function closeOptionalPicker() {
  optionalPicker.set(null);
}
