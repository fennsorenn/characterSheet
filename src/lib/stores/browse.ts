import { writable } from 'svelte/store';
import type { Category } from '../data/index.js';

/** Open state for the detailed import/browse modal, with the category to start on. */
export const browseOpen = writable(false);
export const browseCategory = writable<Category>('item');

export function openBrowse(category: Category = 'item') {
  browseCategory.set(category);
  browseOpen.set(true);
}

export function closeBrowse() {
  browseOpen.set(false);
}
