/**
 * Parser for 5etools' inline `{@tag ...}` markup.
 *
 * 5etools text is not plain prose: it is peppered with tags like
 * `{@damage 1d6}`, `{@item longsword|phb}`, `{@condition prone}`, and these can
 * nest. This module parses such strings into a structured token tree so the UI
 * can render references as clickable links (open in quick-import / lookup) and
 * dice/damage as rollable elements — while plain-text and HTML renderers cover
 * non-interactive contexts (search, exports).
 *
 * The parser is framework-agnostic and exhaustively typed; the Svelte layer
 * consumes the token tree, it does not re-parse.
 */

export type RenderNode =
  | { type: 'text'; value: string }
  | { type: 'tag'; tag: string; parts: RenderNode[][] };

/** How a given tag behaves, used by the renderers. */
type TagKind =
  | 'reference' // links to content: spell, item, creature, condition, …
  | 'roll' // dice / damage / d20
  | 'format' // bold, italic, underline, strike, note
  | 'special'; // bespoke rendering (hit, dc, chance, recharge, atk, h)

interface TagConfig {
  kind: TagKind;
  /** Which pipe-part holds the display text (reference/roll tags). */
  displayIndex?: number;
}

// Tags worth handling explicitly (driven by real-data frequency). Anything not
// listed degrades gracefully to its first part's text.
const TAG_CONFIG: Record<string, TagConfig> = {
  // references — display text is the explicit override part, else the name
  spell: { kind: 'reference', displayIndex: 2 },
  item: { kind: 'reference', displayIndex: 2 },
  creature: { kind: 'reference', displayIndex: 2 },
  condition: { kind: 'reference', displayIndex: 2 },
  status: { kind: 'reference', displayIndex: 2 },
  action: { kind: 'reference', displayIndex: 2 },
  skill: { kind: 'reference', displayIndex: 2 },
  sense: { kind: 'reference', displayIndex: 2 },
  feat: { kind: 'reference', displayIndex: 2 },
  race: { kind: 'reference', displayIndex: 2 },
  class: { kind: 'reference', displayIndex: 2 },
  background: { kind: 'reference', displayIndex: 2 },
  optfeature: { kind: 'reference', displayIndex: 2 },
  variantrule: { kind: 'reference', displayIndex: 2 },
  table: { kind: 'reference', displayIndex: 2 },
  hazard: { kind: 'reference', displayIndex: 2 },
  language: { kind: 'reference', displayIndex: 2 },
  deity: { kind: 'reference', displayIndex: 2 },
  itemProperty: { kind: 'reference', displayIndex: 2 },
  classFeature: { kind: 'reference', displayIndex: 5 },
  subclassFeature: { kind: 'reference', displayIndex: 7 },
  book: { kind: 'reference', displayIndex: 2 },
  adventure: { kind: 'reference', displayIndex: 2 },
  quickref: { kind: 'reference', displayIndex: 4 },
  filter: { kind: 'reference', displayIndex: 0 },
  link: { kind: 'reference', displayIndex: 0 },
  card: { kind: 'reference', displayIndex: 2 },
  deck: { kind: 'reference', displayIndex: 2 },

  // rolls — display override is the part after the formula
  damage: { kind: 'roll', displayIndex: 1 },
  dice: { kind: 'roll', displayIndex: 1 },
  d20: { kind: 'roll', displayIndex: 1 },
  scaledamage: { kind: 'roll', displayIndex: 2 },
  scaledice: { kind: 'roll', displayIndex: 2 },

  // formatting
  b: { kind: 'format' },
  bold: { kind: 'format' },
  i: { kind: 'format' },
  italic: { kind: 'format' },
  s: { kind: 'format' },
  strike: { kind: 'format' },
  u: { kind: 'format' },
  underline: { kind: 'format' },
  note: { kind: 'format' },
  color: { kind: 'format' },
  highlight: { kind: 'format' },
  code: { kind: 'format' },

  // bespoke
  hit: { kind: 'special' },
  dc: { kind: 'special' },
  chance: { kind: 'special' },
  recharge: { kind: 'special' },
  atk: { kind: 'special' },
  h: { kind: 'special' }
};

const ATTACK_TYPES: Record<string, string> = {
  mw: 'Melee Weapon Attack',
  rw: 'Ranged Weapon Attack',
  ms: 'Melee Spell Attack',
  rs: 'Ranged Spell Attack',
  m: 'Melee Attack',
  r: 'Ranged Attack'
};

/** Look up a tag's config, defaulting unknown tags to first-part display. */
export function tagKind(tag: string): TagKind {
  return TAG_CONFIG[tag]?.kind ?? 'reference';
}

/**
 * Parse a tagged string into a token tree. Nested tags and pipe-separated parts
 * are handled at the correct brace depth, so `{@item x|phb|{@i y}}` parses
 * cleanly.
 */
export function parseTaggedString(input: string): RenderNode[] {
  const nodes: RenderNode[] = [];
  let text = '';
  let i = 0;

  const flushText = () => {
    if (text) {
      nodes.push({ type: 'text', value: text });
      text = '';
    }
  };

  while (i < input.length) {
    if (input[i] === '{' && input[i + 1] === '@') {
      const end = findMatchingBrace(input, i);
      if (end === -1) {
        // Unbalanced brace: treat the rest as literal text.
        text += input.slice(i);
        break;
      }
      flushText();
      const inner = input.slice(i + 2, end); // strip "{@" and "}"
      nodes.push(parseTag(inner));
      i = end + 1;
    } else {
      text += input[i];
      i++;
    }
  }
  flushText();
  return nodes;
}

/** Index of the `}` matching the `{` at `start`, honouring nesting; -1 if none. */
function findMatchingBrace(input: string, start: number): number {
  let depth = 0;
  for (let i = start; i < input.length; i++) {
    if (input[i] === '{') depth++;
    else if (input[i] === '}' && --depth === 0) return i;
  }
  return -1;
}

function parseTag(inner: string): RenderNode {
  const spaceIdx = inner.indexOf(' ');
  const tag = spaceIdx === -1 ? inner : inner.slice(0, spaceIdx);
  const rest = spaceIdx === -1 ? '' : inner.slice(spaceIdx + 1);
  const parts = splitTopLevelPipe(rest).map(parseTaggedString);
  return { type: 'tag', tag, parts };
}

/** Split on `|` only at brace depth 0. */
function splitTopLevelPipe(input: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of input) {
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    if (ch === '|' && depth === 0) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

/** Render a token tree to plain display text. */
export function renderToText(nodes: RenderNode[]): string {
  return nodes.map(nodeToText).join('');
}

function nodeToText(node: RenderNode): string {
  if (node.type === 'text') return node.value;

  const partTexts = node.parts.map(renderToText);
  const cfg = TAG_CONFIG[node.tag];
  const display = (idx: number) => partTexts[idx] || partTexts[0] || '';

  switch (cfg?.kind) {
    case 'reference':
    case 'roll':
      return display(cfg.displayIndex ?? 0);
    case 'format':
      return partTexts[0] ?? '';
    case 'special':
      return renderSpecialText(node.tag, partTexts);
    default:
      return partTexts[0] ?? '';
  }
}

function renderSpecialText(tag: string, partTexts: string[]): string {
  const first = partTexts[0] ?? '';
  switch (tag) {
    case 'hit': {
      const n = Number(first);
      return Number.isNaN(n) ? first : `${n >= 0 ? '+' : ''}${n}`;
    }
    case 'dc':
      return `DC ${first}`;
    case 'chance':
      return `${first} percent`;
    case 'recharge':
      return first ? `(Recharge ${first}–6)` : '(Recharge 6)';
    case 'atk':
      return ATTACK_TYPES[first] ?? first;
    case 'h':
      return 'Hit: ';
    default:
      return first;
  }
}

/** Render a token tree to HTML, with data attributes for interactive tags. */
export function renderToHtml(nodes: RenderNode[]): string {
  return nodes.map(nodeToHtml).join('');
}

function nodeToHtml(node: RenderNode): string {
  if (node.type === 'text') return escapeHtml(node.value);

  const cfg = TAG_CONFIG[node.tag];
  const partTexts = node.parts.map(renderToText);
  const display = escapeHtml(nodeToText(node));

  switch (cfg?.kind) {
    case 'reference': {
      const name = escapeHtml(partTexts[0] ?? '');
      const source = escapeHtml(partTexts[1] ?? '');
      return `<a class="tag-ref" data-tag="${escapeAttr(node.tag)}" data-name="${escapeAttr(
        name
      )}" data-source="${escapeAttr(source)}">${display}</a>`;
    }
    case 'roll': {
      const formula = escapeAttr(partTexts[0] ?? '');
      return `<span class="tag-roll" data-roll="${formula}">${display}</span>`;
    }
    case 'format':
      return wrapFormat(node.tag, renderToHtml(node.parts[0] ?? []));
    case 'special':
      return `<span class="tag-${escapeAttr(node.tag)}">${display}</span>`;
    default:
      return display;
  }
}

function wrapFormat(tag: string, inner: string): string {
  switch (tag) {
    case 'b':
    case 'bold':
      return `<strong>${inner}</strong>`;
    case 'i':
    case 'italic':
    case 'note':
      return `<em>${inner}</em>`;
    case 's':
    case 'strike':
      return `<s>${inner}</s>`;
    case 'u':
    case 'underline':
      return `<u>${inner}</u>`;
    case 'code':
      return `<code>${inner}</code>`;
    default:
      return inner;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;');
}
