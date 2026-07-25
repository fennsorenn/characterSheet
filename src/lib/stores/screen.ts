import { readable } from 'svelte/store';
import { categoryForWidth, type ScreenCategory } from '../layout/screen.js';

/**
 * The viewport's current screen-size category, updated on resize. Drives which
 * template a sheet auto-selects (see `applyPreferred` in the layout store).
 */
export const screenCategory = readable<ScreenCategory>(
  typeof window === 'undefined' ? 'desktop' : categoryForWidth(window.innerWidth),
  (set) => {
    if (typeof window === 'undefined') return;
    const update = () => set(categoryForWidth(window.innerWidth));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }
);
