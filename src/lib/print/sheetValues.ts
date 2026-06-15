import {
  ABILITIES,
  ABILITY_NAMES,
  SKILLS,
  skillNodeId,
  totalLevel,
  type Character
} from '../character/index.js';

/**
 * A flat, render-agnostic snapshot of the numbers a character sheet shows,
 * pulled from the character document and its calc graph. Both the fillable PDF
 * and (potentially) other exporters consume this, so the extraction lives in one
 * tested place rather than being re-derived per format.
 */

/** Minimal calc-graph surface needed to read values. */
export interface ValueSource {
  has(id: string): boolean;
  get(id: string): number;
}

export interface NamedValue {
  key: string;
  label: string;
  value: string;
}

export interface SheetValues {
  name: string;
  classLine: string;
  abilities: { key: string; label: string; score: string; mod: string }[];
  combat: { ac: string; initiative: string; prof: string; passive: string };
  hp: { max: string; current: string; temp: string };
  saves: NamedValue[];
  skills: NamedValue[];
  spell?: { dc: string; attack: string };
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

export function collectSheetValues(character: Character, graph: ValueSource): SheetValues {
  const classLine =
    character.classes.map((c) => `${c.name} ${c.level}`).join(' / ') +
    ` · Level ${totalLevel(character)}`;

  const abilities = ABILITIES.map((a) => ({
    key: a,
    label: ABILITY_NAMES[a],
    score: String(character.abilities[a]),
    mod: signed(graph.get(`ability.${a}.mod`))
  }));

  const saves = ABILITIES.map((a) => ({
    key: a,
    label: ABILITY_NAMES[a],
    value: signed(graph.get(`save.${a}`))
  }));

  const skills = SKILLS.map((s) => ({
    key: s,
    label: titleCase(s),
    value: signed(graph.get(skillNodeId(s)))
  }));

  const values: SheetValues = {
    name: character.name,
    classLine,
    abilities,
    combat: {
      ac: String(graph.get('ac')),
      initiative: signed(graph.get('initiative')),
      prof: signed(graph.get('prof.bonus')),
      passive: String(graph.get('passive.perception'))
    },
    hp: {
      max: String(character.hp.max),
      current: String(character.hp.current),
      temp: String(character.hp.temp)
    },
    saves,
    skills
  };

  if (graph.has('spell.dc')) {
    values.spell = {
      dc: String(graph.get('spell.dc')),
      attack: signed(graph.get('spell.attack'))
    };
  }
  return values;
}
