import { describe, it, expect } from 'vitest';
import {
  anchors,
  remindersAt,
  addReminder,
  updateReminder,
  removeReminder,
  moveReminder,
  strandedReminders,
  anchorLabel,
  type Reminder
} from './reminders.js';

const list = (): Reminder[] => [
  { id: 'a', anchor: 'skill.stealth', text: 'disadv. in armor' },
  { id: 'b', anchor: 'skill.stealth', text: 'pass without trace' },
  { id: 'c', anchor: 'save.dex', text: 'evasion' }
];

describe('anchors', () => {
  it('builds stable, lowercase ids', () => {
    expect(anchors.skill('Stealth')).toBe('skill.stealth');
    expect(anchors.save('DEX')).toBe('save.dex');
    expect(anchors.ability('Str')).toBe('ability.str');
    expect(anchors.attack('Longsword')).toBe('attack.longsword');
    expect(anchors.item({ name: 'Potion of Healing', source: 'DMG' })).toBe('item.potion of healing|dmg');
    expect(anchors.spell({ name: 'Misty Step', source: 'PHB' })).toBe('spell.misty step|phb');
    expect(anchors.block('defenses')).toBe('block.defenses');
  });

  it('keeps kinds apart, so a skill and a block never collide', () => {
    expect(anchors.skill('perception')).not.toBe(anchors.block('perception'));
  });
});

describe('reminders', () => {
  it('reads back only the reminders at an anchor, in order', () => {
    expect(remindersAt(list(), 'skill.stealth').map((r) => r.text)).toEqual([
      'disadv. in armor',
      'pass without trace'
    ]);
    expect(remindersAt(list(), 'skill.arcana')).toEqual([]);
    expect(remindersAt(undefined, 'skill.arcana')).toEqual([]);
  });

  it('adds a trimmed reminder and ignores blank text', () => {
    const out = addReminder(list(), 'ability.str', '  carry cap ×2  ', 'n');
    expect(out.at(-1)).toEqual({ id: 'n', anchor: 'ability.str', text: 'carry cap ×2' });
    expect(addReminder(list(), 'ability.str', '   ', 'n')).toHaveLength(3);
    expect(addReminder(undefined, 'ability.str', 'x', 'n')).toHaveLength(1);
  });

  it('edits text, and blanking one deletes it', () => {
    expect(updateReminder(list(), 'a', ' stealth ok now ').find((r) => r.id === 'a')!.text).toBe(
      'stealth ok now'
    );
    expect(updateReminder(list(), 'a', '  ').map((r) => r.id)).toEqual(['b', 'c']);
  });

  it('removes by id, ignoring unknown ones', () => {
    expect(removeReminder(list(), 'b').map((r) => r.id)).toEqual(['a', 'c']);
    expect(removeReminder(list(), 'zz')).toHaveLength(3);
  });

  it('reorders within an anchor without disturbing the others', () => {
    const moved = moveReminder(list(), 'a', 1);
    expect(remindersAt(moved, 'skill.stealth').map((r) => r.id)).toEqual(['b', 'a']);
    // The reminder at another anchor keeps both its place and its identity.
    expect(moved.map((r) => r.id)).toEqual(['b', 'a', 'c']);
    expect(remindersAt(moved, 'save.dex').map((r) => r.id)).toEqual(['c']);
  });

  it('will not move past either end of its own anchor group', () => {
    expect(moveReminder(list(), 'a', -1)).toEqual(list());
    expect(moveReminder(list(), 'b', 1)).toEqual(list());
    // `c` is last overall but alone at its anchor, so it cannot move either way.
    expect(moveReminder(list(), 'c', -1)).toEqual(list());
    expect(moveReminder(list(), 'zz', 1)).toEqual(list());
  });

  it('finds reminders whose anchor is nowhere on the sheet', () => {
    // Sold the item, dropped the block from the template: without this the note
    // would be invisible and impossible to delete.
    const shown = ['skill.stealth'];
    expect(strandedReminders(list(), shown).map((r) => r.id)).toEqual(['c']);
    expect(strandedReminders(list(), ['skill.stealth', 'save.dex'])).toEqual([]);
    expect(strandedReminders(undefined, shown)).toEqual([]);
  });

  it('labels an anchor readably for listing away from its row', () => {
    expect(anchorLabel('skill.stealth')).toBe('Stealth');
    expect(anchorLabel('save.dex')).toBe('Dex save');
    expect(anchorLabel('ability.str')).toBe('Str score');
    expect(anchorLabel('block.defenses')).toBe('Defenses block');
    expect(anchorLabel('item.potion of healing|dmg')).toBe('Potion Of Healing');
    expect(anchorLabel('mystery')).toBe('mystery');
  });
});
