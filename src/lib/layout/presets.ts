import { makeBlock } from './operations.js';
import { SCREEN_CATEGORIES, SCREEN_LABELS, type ScreenCategory } from './screen.js';
import type { BlockInstance, BlockSize, SheetLayout } from './types.js';

/**
 * The templates the app ships with: one per screen-size category × play style.
 *
 * The grid maps sizes to column spans differently at each breakpoint (see
 * LayoutRenderer), so the same arrangement can't be right everywhere — a row
 * that tiles neatly on a desktop becomes a ragged stack on a phone. Each
 * template is therefore built for one breakpoint's arithmetic:
 *
 *   mobile     one column — only order, verbosity and scroll caps matter
 *   tablet     narrow = half, wide = full
 *   desktop    narrow = ¼, wide = ½ (rows are built to total 12 columns)
 *   ultrawide  narrow = ⅙, wide = ⅓ (six narrow or three wide blocks per row)
 *
 * The martial/caster split changes what sits above the fold: weapons, hit dice
 * and resources for one, slots and the spell list for the other. Both keep the
 * other side's blocks — half-casters exist — just further down and smaller.
 *
 * These seed a new library and back "New template", but nothing pins them:
 * once created a template is the user's, and no upgrade rewrites it.
 */

export type TemplateStyle = 'martial' | 'caster';

export const TEMPLATE_STYLES: TemplateStyle[] = ['martial', 'caster'];

export const STYLE_LABELS: Record<TemplateStyle, string> = {
  martial: 'Martial',
  caster: 'Caster'
};

/** Extra per-block options a spec can set beyond variant and size. */
interface SpecOptions {
  /** Stack below the previous block inside one grid cell (a split cell). */
  stack?: boolean;
  /** Pixel cap for a scrollable list block (features / spells / inventory). */
  height?: number;
}

type Spec = [type: string, variant?: string, size?: BlockSize, options?: SpecOptions];

/**
 * Block ids are derived from the template and block type rather than random,
 * so a built-in rebuilt from code is identical every time — keyed `{#each}`
 * blocks keep their DOM, and two calls compare equal. Copies re-randomise them
 * (see `createLayout`), so a forked template is fully independent.
 */
function buildLayout(id: string, name: string, specs: Spec[]): SheetLayout {
  const blocks = specs
    .map(([type, variant, size, options]) => {
      const block = makeBlock(type);
      if (!block) return null;
      block.id = `${id}:${type}`;
      if (variant) block.variant = variant;
      if (size) block.size = size;
      if (options?.stack) block.stack = true;
      if (options?.height) block.height = options.height;
      return block;
    })
    .filter((b): b is BlockInstance => b !== null);
  return { id, name, blocks };
}

/**
 * Default arrangement for the dedicated print layout. On paper the grid is two
 * columns (narrow = half, wide/full = full), so sizes are chosen for a dense,
 * legible single-or-few-page sheet.
 */
export function printDefaultLayout(): SheetLayout {
  return buildLayout('print', 'Print', [
    ['abilityScores', 'full', 'full'],
    ['defenses', 'full', 'full'],
    ['hitPoints', 'full', 'narrow'],
    ['restLevelUp', 'full', 'narrow'],
    ['saves', 'full', 'narrow'],
    ['skills', 'full', 'narrow'],
    ['conditions', 'full', 'narrow'],
    ['resources', 'full', 'narrow'],
    ['effects', 'full', 'narrow'],
    ['attacks', 'full', 'full'],
    ['inventory', 'full', 'full'],
    ['spells', 'full', 'narrow'],
    ['spellSlots', 'full', 'narrow']
  ]);
}

/**
 * Scroll caps for the list blocks. A grid cell is as tall as its content, so an
 * uncapped list next to a short block leaves a band of dead space in the row —
 * these keep the blocks that share a row roughly the same height. Features runs
 * shorter than the others because its header (race/class/feats) sits above the
 * scrolling part.
 */
const PHONE_LIST = 300;
const PHONE_SHORT_LIST = 240;
const TABLET_LIST = 400;
const TABLET_FEATURES = 420;
const DESK_LIST = 320;
const DESK_FEATURES = 520;
const WIDE_LIST = 400;
const WIDE_FEATURES = 300;

const SPECS: Record<ScreenCategory, Record<TemplateStyle, Spec[]>> = {
  // ---- Mobile: one column. Sizes are ignored, so this is purely an order plus
  // terse variants (abilities fold the saves in) and short scroll caps.
  mobile: {
    martial: [
      ['defenses', 'compact'],
      ['hitPoints'],
      ['attacks', 'full', 'full', { height: PHONE_LIST }],
      ['resources'],
      ['conditions'],
      ['effects'],
      ['abilityScores', 'withSaves'],
      ['skills', 'compact'],
      ['inventory', 'full', 'full', { height: PHONE_LIST }],
      ['restLevelUp'],
      ['features', 'full', 'full', { height: PHONE_LIST }],
      ['traits'],
      ['spells', 'full', 'full', { height: PHONE_SHORT_LIST }],
      ['spellSlots', 'grid'],
      ['notes']
    ],
    caster: [
      ['defenses', 'compact'],
      ['hitPoints'],
      ['spellSlots', 'grid'],
      ['spells', 'full', 'full', { height: PHONE_LIST }],
      ['conditions'],
      ['effects'],
      ['resources'],
      ['abilityScores', 'withSaves'],
      ['skills', 'compact'],
      ['inventory', 'full', 'full', { height: PHONE_SHORT_LIST }],
      ['restLevelUp'],
      ['features', 'full', 'full', { height: PHONE_LIST }],
      ['traits'],
      ['attacks'],
      ['notes']
    ]
  },

  // ---- Tablet: narrow = half, wide = full. The headline blocks take the full
  // width (a caster's seven core stats don't fit in half), then the small
  // trackers pair off two to a row and every list runs full width.
  tablet: {
    martial: [
      ['abilityScores', 'full', 'full'],
      ['defenses', 'full', 'full'],
      ['hitPoints', 'full', 'narrow'],
      ['restLevelUp', 'full', 'narrow'],
      ['attacks', 'full', 'wide'],
      ['resources', 'full', 'narrow'],
      ['effects', 'full', 'narrow'],
      ['conditions', 'full', 'narrow'],
      ['saves', 'full', 'narrow'],
      ['skills', 'full', 'wide'],
      ['inventory', 'full', 'wide', { height: TABLET_LIST }],
      ['features', 'full', 'wide', { height: TABLET_FEATURES }],
      ['traits', 'full', 'wide'],
      ['spells', 'full', 'narrow', { height: TABLET_LIST }],
      ['spellSlots', 'grid', 'narrow'],
      ['notes', 'full', 'full']
    ],
    caster: [
      ['abilityScores', 'full', 'full'],
      ['defenses', 'full', 'full'],
      ['hitPoints', 'full', 'narrow'],
      ['restLevelUp', 'full', 'narrow'],
      ['spellSlots', 'full', 'wide'],
      ['spells', 'full', 'wide', { height: TABLET_LIST }],
      ['conditions', 'full', 'narrow'],
      ['effects', 'full', 'narrow'],
      ['resources', 'full', 'narrow'],
      ['saves', 'full', 'narrow'],
      ['skills', 'full', 'wide'],
      ['inventory', 'full', 'wide', { height: TABLET_LIST }],
      ['features', 'full', 'wide', { height: TABLET_FEATURES }],
      ['traits', 'full', 'wide'],
      ['attacks', 'full', 'wide'],
      ['notes', 'full', 'full']
    ]
  },

  // ---- Desktop: narrow = ¼, wide = ½. Rows are written to total 12 columns,
  // and blocks of similar height share a row so none of them trails empty space.
  // Features takes the full width: it is the tallest block and its inline
  // choices (maneuvers, ASIs) need the room.
  desktop: {
    martial: [
      ['abilityScores', 'full', 'wide'],
      ['defenses', 'full', 'wide'],
      ['hitPoints', 'full', 'narrow'],
      ['restLevelUp', 'full', 'narrow'],
      ['attacks', 'full', 'wide'],
      ['conditions', 'full', 'wide'],
      ['resources', 'full', 'wide'],
      ['saves', 'full', 'narrow'],
      ['effects', 'full', 'narrow'],
      ['skills', 'full', 'wide'],
      ['inventory', 'full', 'wide', { height: DESK_LIST }],
      ['traits', 'full', 'wide'],
      ['features', 'full', 'full', { height: DESK_FEATURES }],
      ['spells', 'full', 'narrow', { height: DESK_LIST }],
      ['spellSlots', 'grid', 'narrow'],
      ['notes', 'full', 'wide']
    ],
    caster: [
      ['abilityScores', 'full', 'wide'],
      ['defenses', 'full', 'wide'],
      // Two split cells of stacked trackers stand beside the spell list, so the
      // tall list has columns its own height next to it instead of a gap.
      ['hitPoints', 'full', 'narrow'],
      ['restLevelUp', 'full', 'narrow', { stack: true }],
      ['conditions', 'full', 'narrow', { stack: true }],
      ['spellSlots', 'full', 'narrow'],
      ['saves', 'full', 'narrow', { stack: true }],
      ['effects', 'full', 'narrow', { stack: true }],
      ['spells', 'full', 'wide', { height: 460 }],
      ['resources', 'full', 'narrow'],
      ['attacks', 'full', 'narrow'],
      ['skills', 'full', 'wide'],
      ['inventory', 'full', 'wide', { height: DESK_LIST }],
      ['traits', 'full', 'wide'],
      ['features', 'full', 'full', { height: DESK_FEATURES }],
      ['notes', 'full', 'full']
    ]
  },

  // ---- Ultrawide: narrow = ⅙, wide = ⅓. All six trackers fit on one row, so
  // the whole combat state sits in a single band under the headline blocks and
  // the three lists share the row below it, capped to the same height.
  ultrawide: {
    martial: [
      ['abilityScores', 'full', 'wide'],
      ['defenses', 'full', 'wide'],
      ['attacks', 'full', 'wide'],
      ['hitPoints', 'full', 'narrow'],
      ['restLevelUp', 'full', 'narrow'],
      ['saves', 'full', 'narrow'],
      ['conditions', 'full', 'narrow'],
      ['effects', 'full', 'narrow'],
      ['spellSlots', 'grid', 'narrow'],
      // The martial's one tall block is Features, so it takes the full width
      // rather than stranding two short neighbours beside it.
      ['resources', 'full', 'wide'],
      ['inventory', 'full', 'wide', { height: WIDE_LIST }],
      ['spells', 'full', 'wide', { height: WIDE_LIST }],
      ['features', 'full', 'full', { height: WIDE_FEATURES }],
      ['skills', 'full', 'wide'],
      ['traits', 'full', 'wide'],
      ['notes', 'full', 'wide']
    ],
    caster: [
      ['abilityScores', 'full', 'wide'],
      ['defenses', 'full', 'wide'],
      ['spellSlots', 'full', 'wide'],
      ['hitPoints', 'full', 'narrow'],
      ['restLevelUp', 'full', 'narrow'],
      ['saves', 'full', 'narrow'],
      ['conditions', 'full', 'narrow'],
      ['effects', 'full', 'narrow'],
      ['resources', 'full', 'narrow'],
      ['spells', 'full', 'wide', { height: WIDE_LIST }],
      ['features', 'full', 'wide', { height: WIDE_FEATURES }],
      ['inventory', 'full', 'wide', { height: WIDE_LIST }],
      ['skills', 'full', 'wide'],
      ['traits', 'full', 'wide'],
      ['attacks', 'full', 'wide'],
      ['notes', 'full', 'full']
    ]
  }
};

/** Stable id for a shipped template, e.g. `desktop-caster`. */
export function templateId(category: ScreenCategory, style: TemplateStyle): string {
  return `${category}-${style}`;
}

export function templateName(category: ScreenCategory, style: TemplateStyle): string {
  return `${SCREEN_LABELS[category]} — ${STYLE_LABELS[style]}`;
}

/** One built-in template, rebuilt from these specs (always identical). */
export function defaultTemplate(category: ScreenCategory, style: TemplateStyle): SheetLayout {
  return buildLayout(templateId(category, style), templateName(category, style), SPECS[category][style]);
}

/** All built-in templates, ordered mobile → ultrawide, martial before caster. */
export function defaultTemplates(): SheetLayout[] {
  return SCREEN_CATEGORIES.flatMap((c) => TEMPLATE_STYLES.map((s) => defaultTemplate(c, s)));
}

/** Split a shipped template id back into its category and style, if it is one. */
export function parseTemplateId(
  id: string
): { category: ScreenCategory; style: TemplateStyle } | null {
  for (const category of SCREEN_CATEGORIES) {
    for (const style of TEMPLATE_STYLES) {
      if (templateId(category, style) === id) return { category, style };
    }
  }
  return null;
}

/** A starting point offered by the "New template" form. */
export interface Starter {
  key: string;
  name: string;
  description: string;
}

/**
 * The starting points a new template can be seeded from: an empty page, a copy
 * of what's on screen (both resolved by the caller, which knows the active
 * template), or any of the shipped arrangements.
 */
export const STARTERS: Starter[] = [
  { key: 'blank', name: 'Blank', description: 'No blocks — build it up yourself.' },
  { key: 'current', name: 'Copy of current', description: "The active template's blocks." },
  ...SCREEN_CATEGORIES.flatMap((c) =>
    TEMPLATE_STYLES.map((s) => ({
      key: templateId(c, s),
      name: templateName(c, s),
      description: `The shipped ${SCREEN_LABELS[c].toLowerCase()} arrangement for a ${STYLE_LABELS[s].toLowerCase()}.`
    }))
  )
];

/**
 * Blocks for a starting point (empty for `blank` and for keys the caller
 * resolves itself, like `current`).
 */
export function starterBlocks(key: string): BlockInstance[] {
  const parsed = parseTemplateId(key);
  return parsed ? defaultTemplate(parsed.category, parsed.style).blocks : [];
}
