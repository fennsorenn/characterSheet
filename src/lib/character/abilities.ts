/**
 * 5e ability and skill constants shared by the schema and the calc-graph builder.
 */

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type Ability = (typeof ABILITIES)[number];

export const ABILITY_NAMES: Record<Ability, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma'
};

/** The 18 standard skills mapped to their governing ability. */
export const SKILL_ABILITY = {
  acrobatics: 'dex',
  'animal handling': 'wis',
  arcana: 'int',
  athletics: 'str',
  deception: 'cha',
  history: 'int',
  insight: 'wis',
  intimidation: 'cha',
  investigation: 'int',
  medicine: 'wis',
  nature: 'int',
  perception: 'wis',
  performance: 'cha',
  persuasion: 'cha',
  religion: 'int',
  'sleight of hand': 'dex',
  stealth: 'dex',
  survival: 'wis'
} as const satisfies Record<string, Ability>;

export type Skill = keyof typeof SKILL_ABILITY;
export const SKILLS = Object.keys(SKILL_ABILITY) as Skill[];

/** Proficiency tiers and how they multiply the proficiency bonus. */
export type ProficiencyLevel = 'none' | 'half' | 'proficient' | 'expertise';

export const PROFICIENCY_MULTIPLIER: Record<ProficiencyLevel, number> = {
  none: 0,
  half: 0.5,
  proficient: 1,
  expertise: 2
};

/** Stable calc-node id for a skill (spaces → dots). */
export function skillNodeId(skill: string): string {
  return `skill.${skill.replace(/\s+/g, '.')}`;
}
