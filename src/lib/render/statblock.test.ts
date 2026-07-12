import { describe, it, expect } from 'vitest';
import { applySummonParams, resolveSpecial, buildStatblock } from './statblock.js';
import type { NamedEntry } from '../data/catalog.js';

describe('summon parameter substitution', () => {
  it('replaces the caster/level tokens from real TCE data with labelled rolls', () => {
    const p = { spellLevel: 6, spellAttack: 7, spellDc: 15, profBonus: 3 };
    // To-hit becomes a clickable d20 roll: numeric formula | display | label.
    expect(applySummonParams('{@atk rw} {@hitYourSpellAttack} to hit', p)).toBe(
      '{@atk rw} {@dice d20+7|+7|d20 + Your Spell Attack (+7)} to hit'
    );
    // Damage keeps the numeric value visible; the label is the third part.
    expect(applySummonParams('{@damage 2d6 + 2 + summonSpellLevel} radiant', p)).toBe(
      '{@damage 2d6 + 2 + 6||2d6 + 2 + Spell Level (6)} radiant'
    );
    expect(applySummonParams('{@dice 2d8 + summonSpellLevel}', p)).toBe(
      '{@dice 2d8 + 6||2d8 + Spell Level (6)}'
    );
  });

  it('falls back to prose when no caster context is given', () => {
    expect(applySummonParams('{@hitYourSpellAttack} to hit', {})).toBe('your spell attack modifier to hit');
    expect(applySummonParams('{@damage 1d10 + summonSpellLevel}', {})).toBe("{@damage 1d10 + the spell's level}");
  });
});

describe('AC/HP special resolution', () => {
  it('adds the spell level (natural armor)', () => {
    expect(resolveSpecial('11 + the level of the spell (natural armor)', { spellLevel: 6 }).value).toBe(17);
  });
  it('scales HP per level above a threshold', () => {
    expect(resolveSpecial('40 + 10 for each spell level above 5th', { spellLevel: 7 }).value).toBe(60);
    expect(resolveSpecial('40 + 10 for each spell level above 5th', { spellLevel: 5 }).value).toBe(40);
  });
  it('adds proficiency bonus for "+ PB"', () => {
    expect(resolveSpecial('13 + PB (natural armor)', { profBonus: 4 }).value).toBe(17);
  });
  it('adds class-level scaling', () => {
    expect(resolveSpecial('5 + five times your druid level', { classLevels: { druid: 4 } }).value).toBe(25);
  });
  it('passes unknown phrasings through as prose', () => {
    expect(resolveSpecial('some custom text', {}).value).toBeNull();
  });
});

// A trimmed copy of the real "Celestial Spirit" (TCE) entry.
const celestial: NamedEntry = {
  name: 'Celestial Spirit',
  source: 'TCE',
  summonedBySpell: 'Summon Celestial|TCE',
  summonedBySpellLevel: 5,
  size: ['L'],
  type: 'celestial',
  alignment: ['U'],
  ac: [{ special: '11 + the level of the spell (natural armor)' }],
  hp: { special: '40 + 10 for each spell level above 5th' },
  speed: { walk: 30, fly: 40 },
  str: 16, dex: 14, con: 16, int: 10, wis: 14, cha: 16,
  senses: ['darkvision 60 ft.'],
  passive: 12,
  resist: ['radiant'],
  conditionImmune: ['charmed', 'frightened'],
  languages: ['Celestial', 'understands the languages you speak'],
  action: [
    { name: 'Radiant Bow', entries: ['{@atk rw} {@hitYourSpellAttack} to hit, range 150/600 ft., one target. {@h}{@damage 2d6 + 2 + summonSpellLevel} radiant damage.'] }
  ]
};

describe('buildStatblock (Celestial Spirit)', () => {
  it('resolves AC/HP and ability mods for the chosen level', () => {
    const sb = buildStatblock(celestial, { spellLevel: 7, spellAttack: 8, profBonus: 3 });
    expect(sb.ac).toContain('18'); // 11 + 7
    expect(sb.hpValue).toBe(60); // 40 + 10*(7-5)
    expect(sb.meta).toBe('Large celestial, unaligned');
    expect(sb.abilities.find((a) => a.key === 'STR')?.mod).toBe(3);
    expect(sb.summonMin).toBe(5);
    const bow = sb.groups.flatMap((g) => g.items).find((i) => i.name === 'Radiant Bow');
    expect(bow?.html).toContain('+8'); // spell attack shown as the visible to-hit
    expect(bow?.html).toContain('2d6 + 2 + 7'); // damage stays numeric in the body
    // Symbolic labels ride along for the roller title.
    expect(bow?.html).toContain('d20 + Your Spell Attack (+8)');
    expect(bow?.html).toContain('2d6 + 2 + Spell Level (7)');
  });

  it('defaults the spell level to the creature minimum', () => {
    const sb = buildStatblock(celestial, { spellAttack: 6 });
    expect(sb.hpValue).toBe(40); // level defaults to 5 → 40 + 0
    expect(sb.ac).toContain('16'); // 11 + 5
  });
});
