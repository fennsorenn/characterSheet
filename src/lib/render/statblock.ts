import type { NamedEntry } from '../data/catalog.js';
import { parseTaggedString, renderToHtml, renderToText } from './tags.js';

/**
 * Build a creature statblock for the detail window / pinned dock from a 5etools
 * bestiary entry, resolving the "summon" parameterization where possible.
 *
 * Summon-spell statblocks (Tasha's spirits, etc.) are not plain text: they carry
 * tokens that depend on the caster and the spell level used. From the real data
 * (bestiary-tce.json) the tokens are:
 *   - `{@hitYourSpellAttack}`  → the caster's spell attack bonus.
 *   - `summonSpellLevel` (bare word inside `{@damage …}`/`{@dice …}`) → the level.
 *   - AC `special`: "11 + the level of the spell (natural armor)", "13 + PB …".
 *   - HP `special`: "40 + 10 for each spell level above 5th", "… five times your
 *     druid level", etc.
 * Given a {@link StatblockParams} context we substitute concrete numbers; without
 * one we fall back to readable prose so the block still renders.
 */

export interface StatblockParams {
  /** Chosen summon spell level (defaults to the creature's minimum). */
  spellLevel?: number;
  /** Caster's spell attack bonus, e.g. 7 → "+7 to hit". */
  spellAttack?: number;
  /** Caster's spell save DC. */
  spellDc?: number;
  /** Caster's proficiency bonus (for "+ PB" AC/HP). */
  profBonus?: number;
  /** Character class levels (lowercased name → level) for class-summon scaling. */
  classLevels?: Record<string, number>;
}

export interface AbilityScore {
  key: string;
  score: number;
  mod: number;
}

export interface StatblockGroup {
  title: string;
  /** Each entry rendered to HTML (name + body). */
  items: { name?: string; html: string }[];
}

export interface Statblock {
  name: string;
  /** "Large celestial, unaligned". */
  meta: string;
  ac: string;
  hp: string;
  hpValue: number | null;
  speed: string;
  abilities: AbilityScore[];
  /** Saves, skills, senses, resistances, languages, CR, … as labelled lines. */
  lines: { label: string; value: string }[];
  groups: StatblockGroup[];
  source: string;
  /** Minimum summon level when this is a summon-spell statblock (enables the control). */
  summonMin?: number;
  /** Number of legendary actions per round, when the creature has them. */
  legendary?: number;
  /** Names of actions gated by a recharge roll (for the pinned uses tracker). */
  recharge: string[];
}

const SIZES: Record<string, string> = {
  T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan'
};
const ALIGN: Record<string, string> = {
  L: 'lawful', N: 'neutral', C: 'chaotic', G: 'good', E: 'evil',
  U: 'unaligned', A: 'any alignment'
};

const abilMod = (score: number) => Math.floor((score - 10) / 2);

/** Replace summon tokens in one entry string, given the parameter context. */
export function applySummonParams(text: string, p: StatblockParams): string {
  let out = text;
  // {@hitYourSpellAttack} → {@hit N} (reuses the existing @hit renderer), else prose.
  out = out.replace(/\{@hitYourSpellAttack\}/g, () =>
    p.spellAttack != null ? `{@hit ${p.spellAttack}}` : 'your spell attack modifier'
  );
  out = out.replace(/\{@dcYourSpellSave\}/g, () =>
    p.spellDc != null ? `{@dc ${p.spellDc}}` : 'your spell save DC'
  );
  // Bare `summonSpellLevel` inside {@damage …}/{@dice …} formulas → the number.
  out = out.replace(/\bsummonSpellLevel\b/g, () =>
    p.spellLevel != null ? String(p.spellLevel) : "the spell's level"
  );
  return out;
}

/**
 * Resolve an AC/HP `special` string to a concrete number where the pattern is
 * recognised, returning both the number (if any) and a display string with
 * tokens substituted. Best-effort: unknown phrasings pass through as prose.
 */
export function resolveSpecial(
  special: string,
  p: StatblockParams
): { value: number | null; text: string } {
  let text = special;
  const baseMatch = special.match(/^\s*(\d+)/);
  let value: number | null = baseMatch ? Number(baseMatch[1]) : null;

  // "N + the level of the spell" — add the spell level.
  if (/the level of the spell/i.test(special)) {
    if (p.spellLevel != null && value != null) value += p.spellLevel;
    text = text.replace(/the level of the spell/gi, p.spellLevel != null ? String(p.spellLevel) : 'the spell level');
  }
  // "+ PB" — add proficiency bonus.
  if (/\bPB\b/.test(special)) {
    if (p.profBonus != null && value != null) value += p.profBonus;
    text = text.replace(/\bPB\b/g, p.profBonus != null ? String(p.profBonus) : 'PB');
  }
  // "K for each spell level above Nth" — add K per level over the threshold.
  const each = special.match(/(\d+)\s+for each spell level above (\d+)(?:st|nd|rd|th)/i);
  if (each) {
    const per = Number(each[1]);
    const threshold = Number(each[2]);
    if (p.spellLevel != null && value != null) value += per * Math.max(0, p.spellLevel - threshold);
  }
  // "K times your CLASS level" — add K per matched class level.
  const times = special.match(/(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+times your (\w+) level/i);
  if (times) {
    const per = wordToNum(times[1]);
    const lvl = p.classLevels?.[times[2].toLowerCase()];
    if (per != null && lvl != null && value != null) value += per * lvl;
  }
  return { value, text };
}

const WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10
};
function wordToNum(w: string): number | null {
  const n = WORDS[w.toLowerCase()];
  if (n != null) return n;
  const parsed = Number(w);
  return Number.isNaN(parsed) ? null : parsed;
}

function renderEntry(text: string, p: StatblockParams): string {
  return renderToHtml(parseTaggedString(applySummonParams(text, p)));
}

function creatureType(entry: NamedEntry): string {
  const t = entry.type;
  if (typeof t === 'string') return t;
  if (t && typeof t === 'object') {
    const o = t as { type?: string; tags?: unknown[] };
    const tags = Array.isArray(o.tags) ? o.tags.map((x) => (typeof x === 'string' ? x : (x as { tag?: string })?.tag)).filter(Boolean) : [];
    return `${o.type ?? ''}${tags.length ? ` (${tags.join(', ')})` : ''}`.trim();
  }
  return '';
}

function alignment(entry: NamedEntry): string {
  const a = entry.alignment;
  if (!Array.isArray(a)) return '';
  return a.map((x) => (typeof x === 'string' ? (ALIGN[x] ?? x) : '')).filter(Boolean).join(' ');
}

function metaLine(entry: NamedEntry): string {
  const size = Array.isArray(entry.size) ? (SIZES[String(entry.size[0])] ?? '') : '';
  const type = creatureType(entry);
  const align = alignment(entry);
  return [[size, type].filter(Boolean).join(' '), align].filter(Boolean).join(', ');
}

function acText(entry: NamedEntry, p: StatblockParams): string {
  const ac = entry.ac;
  if (typeof ac === 'number') return String(ac);
  if (!Array.isArray(ac)) return '';
  return ac
    .map((a) => {
      if (typeof a === 'number') return String(a);
      const o = a as { ac?: number; from?: string[]; special?: string };
      if (o.special) {
        const r = resolveSpecial(o.special, p);
        return r.value != null ? `${r.value} (${r.text})` : r.text;
      }
      return `${o.ac ?? ''}${o.from?.length ? ` (${o.from.map((f) => renderToText(parseTaggedString(f))).join(', ')})` : ''}`;
    })
    .join(', ');
}

function hpParts(entry: NamedEntry, p: StatblockParams): { text: string; value: number | null } {
  const hp = entry.hp as { average?: number; formula?: string; special?: string } | undefined;
  if (!hp) return { text: '', value: null };
  if (hp.special) {
    const r = resolveSpecial(hp.special, p);
    return { text: r.value != null ? `${r.value} (${r.text})` : r.text, value: r.value };
  }
  const avg = hp.average;
  return {
    text: `${avg ?? ''}${hp.formula ? ` (${hp.formula})` : ''}`.trim(),
    value: typeof avg === 'number' ? avg : null
  };
}

function speedText(entry: NamedEntry): string {
  const s = entry.speed;
  if (typeof s === 'number') return `${s} ft.`;
  if (!s || typeof s !== 'object') return '';
  const o = s as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof o.walk === 'number') parts.push(`${o.walk} ft.`);
  for (const mode of ['burrow', 'climb', 'fly', 'swim']) {
    const v = o[mode];
    if (typeof v === 'number') parts.push(`${mode} ${v} ft.${mode === 'fly' && o.canHover ? ' (hover)' : ''}`);
  }
  return parts.join(', ');
}

function labelledLines(entry: NamedEntry, p: StatblockParams): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = [];
  const push = (label: string, value: string) => value && lines.push({ label, value });
  const objLine = (o: unknown) =>
    o && typeof o === 'object'
      ? Object.entries(o as Record<string, string>).map(([k, v]) => `${k[0].toUpperCase() + k.slice(1)} ${v}`).join(', ')
      : '';
  const arr = (v: unknown) => (Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : '')).filter(Boolean).join(', ') : '');

  push('Saving Throws', objLine(entry.save));
  push('Skills', objLine(entry.skill));
  push('Damage Vulnerabilities', arr(entry.vulnerable));
  push('Damage Resistances', arr(entry.resist));
  push('Damage Immunities', arr(entry.immune));
  push('Condition Immunities', arr(entry.conditionImmune));
  const senses = [...(Array.isArray(entry.senses) ? entry.senses as string[] : [])];
  if (typeof entry.passive === 'number') senses.push(`passive Perception ${entry.passive}`);
  push('Senses', senses.join(', '));
  push('Languages', arr(entry.languages));
  if (entry.cr != null) push('Challenge', typeof entry.cr === 'object' ? String((entry.cr as { cr?: string }).cr ?? '') : String(entry.cr));
  return lines.map((l) => ({ label: l.label, value: renderToText(parseTaggedString(applySummonParams(l.value, p))) }));
}

/** One named block (trait/action/…) → { name, html }. */
function renderNamed(list: unknown, p: StatblockParams): { name?: string; html: string }[] {
  if (!Array.isArray(list)) return [];
  return list.map((raw) => {
    const o = raw as { name?: string; entries?: unknown[] };
    const body = Array.isArray(o.entries)
      ? o.entries.map((e) => (typeof e === 'string' ? `<p>${renderEntry(e, p)}</p>` : '')).join('')
      : '';
    return { name: o.name, html: body };
  });
}

/** Build the full statblock model, resolving summon params from `params`. */
export function buildStatblock(entry: NamedEntry, params: StatblockParams = {}): Statblock {
  // Default the summon level to the creature's minimum when not chosen.
  const summonMin = typeof entry.summonedBySpellLevel === 'number' ? entry.summonedBySpellLevel : undefined;
  const p: StatblockParams = { ...params, spellLevel: params.spellLevel ?? summonMin };

  const abilities: AbilityScore[] = (['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((k) => {
    const score = typeof entry[k] === 'number' ? (entry[k] as number) : 10;
    return { key: k.toUpperCase(), score, mod: abilMod(score) };
  });

  const hp = hpParts(entry, p);
  const groups: StatblockGroup[] = [];
  const addGroup = (title: string, list: unknown) => {
    const items = renderNamed(list, p);
    if (items.length) groups.push({ title, items });
  };
  addGroup('Traits', entry.trait);
  addGroup('Actions', entry.action);
  addGroup('Bonus Actions', entry.bonus);
  addGroup('Reactions', entry.reaction);
  addGroup('Legendary Actions', entry.legendary);

  const legendary = Array.isArray(entry.legendary)
    ? (typeof entry.legendaryActions === 'number' ? entry.legendaryActions : 3)
    : undefined;

  // Actions gated by a recharge roll ("{@recharge 5}") — tracked in the dock.
  const recharge = (Array.isArray(entry.action) ? entry.action : [])
    .filter((a) => {
      const o = a as { entries?: unknown[] };
      return Array.isArray(o.entries) && o.entries.some((e) => typeof e === 'string' && /\{@recharge/.test(e));
    })
    .map((a) => (a as { name?: string }).name ?? '')
    .filter(Boolean);

  return {
    name: entry.name,
    meta: metaLine(entry),
    ac: acText(entry, p),
    hp: hp.text,
    hpValue: hp.value,
    speed: speedText(entry),
    abilities,
    lines: labelledLines(entry, p),
    groups,
    source: String(entry.source),
    summonMin,
    legendary,
    recharge
  };
}
