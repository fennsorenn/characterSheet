// Basic UI icons vendored from Lucide (https://lucide.dev), ISC licensed.
// See ICON_CREDITS.md. These are stroke icons on a 24x24 viewBox rendered with
// currentColor — distinct from the fill-style game-icons set in
// icons.generated.ts. Inner markup only; UiIcon.svelte supplies the <svg> shell.
/* eslint-disable */
export const UI_ICONS: Record<string, string> = {
  close: `<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`,
  check: `<path d="M20 6 9 17l-5-5"/>`,
  'chevron-down': `<path d="m6 9 6 6 6-6"/>`,
  'chevron-right': `<path d="m9 18 6-6-6-6"/>`,
  pencil: `<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>`,
  'arrow-up': `<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>`,
  'arrow-down': `<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>`,
  // Star path; render filled by passing `filled` to UiIcon (favorite ON), else outline.
  star: `<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>`
};
