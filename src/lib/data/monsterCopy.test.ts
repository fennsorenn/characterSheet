import { describe, it, expect } from 'vitest';
import { resolveMonsters } from './monsterCopy.js';
import type { NamedEntry } from './catalog.js';

// Real base from bestiary-mm.json (trimmed).
const direWolf: NamedEntry = {
  name: 'Dire Wolf',
  source: 'MM',
  size: ['L'],
  type: 'beast',
  hp: { average: 37, formula: '5d10 + 10' },
  ac: [{ ac: 14, from: ['natural armor'] }],
  str: 17, dex: 15, con: 15, int: 3, wis: 12, cha: 7,
  trait: [
    { name: 'Keen Hearing and Smell', entries: ['The wolf has advantage on Wisdom ({@skill Perception}) checks that rely on hearing or smell.'] },
    { name: 'Pack Tactics', entries: ["The wolf has advantage on an attack roll against a creature if at least one of the wolf's allies is within 5 feet of the creature."] }
  ],
  action: [{ name: 'Bite', entries: ['{@atk mw} {@hit 5} to hit. {@h}{@damage 2d6 + 3} piercing damage.'] }]
};

// Real copy from bestiary-xge.json (trimmed): replaceTxt wolf→hound + append traits.
const houndOfIllOmen: NamedEntry = {
  name: 'Hound of Ill Omen',
  source: 'XGE',
  _copy: {
    name: 'Dire Wolf',
    source: 'MM',
    _mod: {
      '*': { mode: 'replaceTxt', replace: '\\bwolf\\b', with: 'hound' },
      trait: [
        {
          mode: 'appendArr',
          items: [
            { name: 'Cloak of Shadows', entries: ['The hound appears with temporary hit points equal to half your sorcerer level.'] },
            { name: 'Omen Sight', entries: ["At the start of its turn, the hound knows its target's location."] }
          ]
        }
      ]
    }
  },
  size: ['M'],
  type: 'monstrosity'
} as unknown as NamedEntry;

describe('resolveMonsters — _copy inheritance', () => {
  it('inherits base stats and applies mods', () => {
    const out = resolveMonsters([direWolf, houndOfIllOmen]);
    const hound = out.find((m) => m.name === 'Hound of Ill Omen') as NamedEntry;
    // Inherited from the base (copy omitted them).
    expect((hound.hp as { average: number }).average).toBe(37);
    expect((hound.ac as [{ ac: number }])[0].ac).toBe(14);
    expect(hound.str).toBe(17);
    // Own fields win.
    expect(hound.size).toEqual(['M']);
    expect(hound.type).toBe('monstrosity');
    // appendArr added the two new traits (2 base + 2 appended).
    const traits = hound.trait as { name: string; entries: string[] }[];
    expect(traits).toHaveLength(4);
    expect(traits.map((t) => t.name)).toContain('Omen Sight');
    // replaceTxt turned "wolf" into "hound" in inherited trait text, without
    // touching the base creature.
    expect(traits[0].entries[0]).toContain('hound');
    expect(traits[0].entries[0]).not.toContain('wolf');
    expect((direWolf.trait as { entries: string[] }[])[0].entries[0]).toContain('wolf');
  });

  it('renders own fields when the base is missing', () => {
    const out = resolveMonsters([houndOfIllOmen]);
    const hound = out.find((m) => m.name === 'Hound of Ill Omen') as NamedEntry;
    expect(hound.type).toBe('monstrosity');
    expect((hound as { _copy?: unknown })._copy).toBeUndefined();
  });
});

// Real _versions from bestiary-tce.json (trimmed).
const celestialSpirit: NamedEntry = {
  name: 'Celestial Spirit',
  source: 'TCE',
  summonedBySpellLevel: 5,
  size: ['L'],
  type: 'celestial',
  ac: [{ special: '11 + the level of the spell (natural armor) + 2 (Defender only)' }],
  str: 16, dex: 14, con: 16, int: 10, wis: 14, cha: 16,
  action: [
    { name: 'Radiant Bow (Avenger Only)', entries: ['{@atk rw} {@hitYourSpellAttack} to hit. {@h}{@damage 2d6 + 2 + summonSpellLevel} radiant damage.'] },
    { name: 'Radiant Mace (Defender Only)', entries: ['{@atk mw} {@hitYourSpellAttack} to hit. {@h}{@damage 1d10 + 3 + summonSpellLevel} radiant damage.'] }
  ],
  _versions: [
    {
      name: 'Celestial Spirit (Avenger)', source: 'TCE',
      ac: [{ special: '11 + the level of the spell (natural armor)' }],
      _mod: {
        action: [
          { mode: 'renameArr', renames: { rename: 'Radiant Bow (Avenger Only)', with: 'Radiant Bow' } },
          { mode: 'removeArr', names: 'Radiant Mace (Defender Only)' }
        ]
      }
    },
    {
      name: 'Celestial Spirit (Defender)', source: 'TCE',
      ac: [{ special: '13 + the level of the spell (natural armor)' }],
      _mod: {
        action: [
          { mode: 'renameArr', renames: { rename: 'Radiant Mace (Defender Only)', with: 'Radiant Mace' } },
          { mode: 'removeArr', names: 'Radiant Bow (Avenger Only)' }
        ]
      }
    }
  ]
} as unknown as NamedEntry;

describe('resolveMonsters — _versions expansion', () => {
  it('produces the parent plus each version with mods applied', () => {
    const out = resolveMonsters([celestialSpirit]);
    const names = out.map((m) => m.name);
    expect(names).toEqual([
      'Celestial Spirit',
      'Celestial Spirit (Avenger)',
      'Celestial Spirit (Defender)'
    ]);

    const avenger = out.find((m) => m.name === 'Celestial Spirit (Avenger)') as NamedEntry;
    // Inherited ability scores from the parent.
    expect(avenger.str).toBe(16);
    // Own AC override retained (no "+ 2 (Defender only)").
    expect((avenger.ac as [{ special: string }])[0].special).toBe('11 + the level of the spell (natural armor)');
    // renameArr + removeArr applied: single "Radiant Bow" action.
    const actions = avenger.action as { name: string }[];
    expect(actions).toHaveLength(1);
    expect(actions[0].name).toBe('Radiant Bow');

    // Parent kept, without _versions leaking through.
    const parent = out[0] as { _versions?: unknown };
    expect(parent._versions).toBeUndefined();
  });
});
