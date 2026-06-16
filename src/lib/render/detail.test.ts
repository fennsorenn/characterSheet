import { describe, it, expect } from 'vitest';
import { detailContent, detailDocument } from './detail.js';
import type { NamedEntry } from '../data/catalog.js';

const fireball: NamedEntry = {
  name: 'Fireball',
  source: 'PHB',
  level: 3,
  school: 'V',
  time: [{ number: 1, unit: 'action' }],
  range: { type: 'point', distance: { type: 'feet', amount: 150 } },
  components: { v: true, s: true, m: 'a tiny ball of bat guano and sulfur' },
  duration: [{ type: 'instant' }],
  _classes: ['Sorcerer', 'Wizard'],
  entries: ['A bright streak flashes from your pointing finger.']
};

const cloak: NamedEntry = {
  name: 'Cloak of Protection',
  source: 'DMG',
  type: 'WD',
  rarity: 'uncommon',
  reqAttune: true,
  weight: 1,
  entries: ['You gain a +1 bonus to AC and saving throws while you wear this cloak.']
};

describe('detailContent', () => {
  it('formats a spell: level/school subtitle and meta lines', () => {
    const c = detailContent('spell', fireball);
    expect(c.title).toBe('Fireball');
    expect(c.subtitle).toBe('3rd-level Evocation');
    const meta = Object.fromEntries(c.meta.map((m) => [m.label, m.value]));
    expect(meta['Casting Time']).toBe('1 action');
    expect(meta['Range']).toBe('150 feet');
    expect(meta['Components']).toBe('V, S, M (a tiny ball of bat guano and sulfur)');
    expect(meta['Duration']).toBe('Instantaneous');
    expect(meta['Classes']).toBe('Sorcerer, Wizard');
    expect(c.html).toContain('bright streak');
  });

  it('shows "cantrip" for level-0 spells', () => {
    expect(detailContent('spell', { ...fireball, level: 0 }).subtitle).toBe('Evocation cantrip');
  });

  it('formats an item: rarity + attunement meta', () => {
    const c = detailContent('item', cloak);
    const meta = Object.fromEntries(c.meta.map((m) => [m.label, m.value]));
    expect(meta['Rarity']).toBe('uncommon');
    expect(meta['Attunement']).toBe('Required');
    expect(c.html).toContain('+1 bonus to AC');
  });

  it('produces a standalone pop-out document', () => {
    const doc = detailDocument(detailContent('spell', fireball));
    expect(doc).toContain('<!doctype html>');
    expect(doc).toContain('Fireball');
    expect(doc).toContain('3rd-level Evocation');
  });
});
