/**
 * Screen-size categories.
 *
 * A template that reads well on an ultrawide monitor is rarely the one you want
 * on a phone, so a template can be designated the preferred one *per category*.
 * The boundaries mirror the grid breakpoints in LayoutRenderer, so a category
 * change is exactly the point where the grid reflows.
 */

export type ScreenCategory = 'mobile' | 'tablet' | 'desktop' | 'ultrawide';

export const SCREEN_CATEGORIES: ScreenCategory[] = ['mobile', 'tablet', 'desktop', 'ultrawide'];

export const SCREEN_LABELS: Record<ScreenCategory, string> = {
  mobile: 'Mobile',
  tablet: 'Tablet',
  desktop: 'Desktop',
  ultrawide: 'Ultrawide'
};

/** Upper bound (inclusive) of each bounded category, in CSS pixels. */
export const SCREEN_MAX_WIDTH: Record<Exclude<ScreenCategory, 'ultrawide'>, number> = {
  mobile: 680,
  tablet: 1100,
  desktop: 1699
};

export const SCREEN_HINTS: Record<ScreenCategory, string> = {
  mobile: `≤ ${SCREEN_MAX_WIDTH.mobile}px — single column`,
  tablet: `≤ ${SCREEN_MAX_WIDTH.tablet}px — narrow blocks go half-width`,
  desktop: `≤ ${SCREEN_MAX_WIDTH.desktop}px — full 12-column grid`,
  ultrawide: `> ${SCREEN_MAX_WIDTH.desktop}px — extra blocks per row`
};

/** Which category a viewport width falls into. */
export function categoryForWidth(width: number): ScreenCategory {
  if (width <= SCREEN_MAX_WIDTH.mobile) return 'mobile';
  if (width <= SCREEN_MAX_WIDTH.tablet) return 'tablet';
  if (width <= SCREEN_MAX_WIDTH.desktop) return 'desktop';
  return 'ultrawide';
}

/** Narrow an untrusted string (stored JSON, URL) to a known category. */
export function isScreenCategory(value: unknown): value is ScreenCategory {
  return typeof value === 'string' && (SCREEN_CATEGORIES as string[]).includes(value);
}
