import { writable, derived } from 'svelte/store';
import {
  redactionClasses,
  type CustomRedaction,
  type PrefillLevel
} from '../print/redaction.js';

/** Print/PDF settings and the open state of the print view. */
export type PageSize = 'letter' | 'a4';

export const printOpen = writable(false);
export const pageSize = writable<PageSize>('letter');
export const prefill = writable<PrefillLevel>('all');
export const customRedaction = writable<CustomRedaction>({
  frequent: false,
  occasional: false
});

/** Classes the print container carries to drive value redaction. */
export const printClasses = derived(
  [pageSize, prefill, customRedaction],
  ([$size, $level, $custom]) =>
    [`page-${$size}`, ...redactionClasses($level, $custom)].join(' ')
);

export function openPrint() {
  printOpen.set(true);
}
export function closePrint() {
  printOpen.set(false);
}

/** Trigger the browser print dialog (also the path to "Save as PDF"). */
export function printNow() {
  if (typeof window !== 'undefined') window.print();
}
