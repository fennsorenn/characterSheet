import { ABILITIES, SKILLS, skillNodeId, type Ability, type Skill } from './abilities.js';
import { maxNumeric, memberLabel, setMembers, type GrantPool, type SetCategory } from './grants.js';
import { totalLevel, type Character, type RestType } from './schema.js';
import type { FeatureResource } from './featureResources.js';
import type { SpellSlotInfo } from './spellSlots.js';

/**
 * A small, flat digest of the numbers a GM wants from a character without the
 * catalog or the calc engine: level, AC, saves, passives, speed, languages,
 * resources and slot maxima.
 *
 * Derived stats only exist where the dataset is loaded — in the player's
 * browser — so the sheet computes this on save and the server stores it beside
 * the document. It is exactly as fresh as the last save from an open sheet. It
 * deliberately carries no timestamp: two saves of the same character produce
 * the same summary, so "did the summary change?" is a plain comparison.
 *
 * The server also reads `resources`, `spellSlots` and `pact` from it to know
 * the maxima a GM's status write is clamped to (see server/status.mjs).
 */

export const SUMMARY_VERSION = 1;

export interface SummaryResource {
  /** A custom resource's id, or an implicit class resource's stable key. */
  key: string;
  name: string;
  max: number;
  recharge: RestType;
  kind: 'custom' | 'feature';
}

export interface CharacterSummary {
  v: number;
  name: string;
  level: number;
  classes: { name: string; subclass?: string; level: number }[];
  race?: string;
  background?: string;
  ac: number;
  maxHp: number;
  initiative: number;
  profBonus: number;
  /** Speeds by mode (walk, fly, swim, …) in feet. */
  speed: Record<string, number>;
  /** Senses by name (darkvision, …) in feet. */
  senses: Record<string, number>;
  passive: { perception: number; insight: number; investigation: number };
  abilities: Record<Ability, { score: number; mod: number }>;
  saves: Record<Ability, number>;
  skills: Record<Skill, number>;
  spell?: { dc: number; attack: number };
  languages: string[];
  resistances: string[];
  immunities: string[];
  conditionImmunities: string[];
  resources: SummaryResource[];
  /** Effective slot maxima (auto-computed or manual), levels with any slots. */
  spellSlots: { level: number; max: number }[];
  pact: { level: number; max: number } | null;
}

/** Minimal calc-graph surface the summary reads. */
export interface SummaryGraph {
  has(id: string): boolean;
  get(id: string): number;
}

export interface SummaryInput {
  character: Character;
  graph: SummaryGraph;
  grants: GrantPool;
  slots: SpellSlotInfo;
  featureResources: FeatureResource[];
}

const read = (g: SummaryGraph, id: string, fallback = 0) => (g.has(id) ? g.get(id) : fallback);
const members = (grants: GrantPool, category: SetCategory) =>
  setMembers(grants, category).map((m) => memberLabel(category, m.member));
const byName = (list: { name: string; value: number }[]) =>
  Object.fromEntries(list.map((x) => [x.name, x.value]).sort(([a], [b]) => String(a).localeCompare(String(b))));

export function computeSummary({ character: c, graph: g, grants, slots, featureResources }: SummaryInput): CharacterSummary {
  const abilities = {} as CharacterSummary['abilities'];
  const saves = {} as CharacterSummary['saves'];
  for (const a of ABILITIES) {
    abilities[a] = { score: read(g, `ability.${a}.score`, c.abilities[a]), mod: read(g, `ability.${a}.mod`) };
    saves[a] = read(g, `save.${a}`);
  }
  const skills = {} as CharacterSummary['skills'];
  for (const s of SKILLS) skills[s] = read(g, skillNodeId(s));

  const slotMax = (i: number) => (c.spellSlotsAuto ? slots.slots[i] ?? 0 : c.spellSlots[i]?.max ?? 0);
  const spellSlots: CharacterSummary['spellSlots'] = [];
  for (let i = 0; i < 9; i++) if (slotMax(i) > 0) spellSlots.push({ level: i + 1, max: slotMax(i) });

  const summary: CharacterSummary = {
    v: SUMMARY_VERSION,
    name: c.name,
    level: totalLevel(c),
    classes: c.classes.map((cl) => ({ name: cl.name, ...(cl.subclass ? { subclass: cl.subclass } : {}), level: cl.level })),
    ...(c.race ? { race: c.race.name } : {}),
    ...(c.background ? { background: c.background.name } : {}),
    ac: read(g, 'ac', 10),
    maxHp: c.hp.max,
    initiative: read(g, 'initiative'),
    profBonus: read(g, 'prof.bonus', 2),
    speed: byName(maxNumeric(grants, 'speed.')),
    senses: byName(maxNumeric(grants, 'sense.')),
    passive: {
      perception: read(g, 'passive.perception', 10),
      insight: read(g, 'passive.insight', 10),
      investigation: read(g, 'passive.investigation', 10)
    },
    abilities,
    saves,
    skills,
    languages: members(grants, 'language'),
    resistances: members(grants, 'resist'),
    immunities: members(grants, 'immune'),
    conditionImmunities: members(grants, 'conditionImmune'),
    resources: [
      ...c.resources.map((r): SummaryResource => ({ key: r.id, name: r.name, max: r.max, recharge: r.recharge, kind: 'custom' })),
      ...featureResources.map((r): SummaryResource => ({ key: r.key, name: r.name, max: r.max, recharge: r.recharge, kind: 'feature' }))
    ],
    spellSlots,
    pact: slots.pact ? { level: slots.pact.level, max: slots.pact.count } : null
  };
  if (g.has('spell.dc')) summary.spell = { dc: g.get('spell.dc'), attack: read(g, 'spell.attack') };
  return summary;
}
