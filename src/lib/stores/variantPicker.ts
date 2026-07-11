import { writable } from 'svelte/store';

/** The base item whose magic variants are being picked. */
export interface VariantPickerTarget {
  name: string;
  source: string;
}

export const variantPicker = writable<VariantPickerTarget | null>(null);

export function openVariantPicker(target: VariantPickerTarget) {
  variantPicker.set(target);
}
export function closeVariantPicker() {
  variantPicker.set(null);
}
