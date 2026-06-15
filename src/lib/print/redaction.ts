/**
 * Print prefill levels.
 *
 * When printing a sheet to fill in by hand, you often want to omit values that
 * change a lot. Fields are tagged with a volatility (`data-volatile`):
 *   - frequent: HP, spell slots, feature uses — change every encounter
 *   - occasional: AC, ability scores — change on level-up / gear swaps
 * A prefill level maps to a set of CSS classes the print container carries;
 * global CSS then hides the matching values (keeping the labelled boxes).
 */
export type PrefillLevel =
  | 'all' // every value printed
  | 'omit-frequent' // blank the things that change often
  | 'omit-occasional' // also blank AC / ability scores
  | 'blank' // blank every value (a template to fill by hand)
  | 'custom';

export interface CustomRedaction {
  frequent: boolean;
  occasional: boolean;
}

export const PREFILL_LABELS: Record<PrefillLevel, string> = {
  all: 'All values',
  'omit-frequent': 'Omit frequent (HP, slots, uses)',
  'omit-occasional': 'Omit frequent + occasional (AC, scores)',
  blank: 'Blank (template)',
  custom: 'Custom…'
};

/** Resolve a prefill level into the redaction classes for the print container. */
export function redactionClasses(
  level: PrefillLevel,
  custom: CustomRedaction
): string[] {
  switch (level) {
    case 'all':
      return [];
    case 'omit-frequent':
      return ['hide-frequent'];
    case 'omit-occasional':
      return ['hide-frequent', 'hide-occasional'];
    case 'blank':
      return ['hide-all'];
    case 'custom':
      return [
        custom.frequent ? 'hide-frequent' : '',
        custom.occasional ? 'hide-occasional' : ''
      ].filter(Boolean);
  }
}
