import { describe, it, expect } from 'vitest';
import { classifyAbility, classifyAc } from './overrides.js';

describe('classifyAbility', () => {
  it('treats a pure ASI delta as persistent — kind "none", no badge', () => {
    const c = classifyAbility(15, 2, []); // base 15 + ASI +2
    expect(c.persistentEffective).toBe(17);
    expect(c.fleetingEffective).toBe(17);
    expect(c.kind).toBe('none');
  });

  it('flags an equipment SET (Belt of Giant Strength → 21) as equipment', () => {
    const c = classifyAbility(15, 0, [], 21);
    expect(c.persistentEffective).toBe(15);
    expect(c.fleetingEffective).toBe(21);
    expect(c.kind).toBe('equipment');
  });

  it('does not badge an equipment set that is below the current score', () => {
    const c = classifyAbility(22, 0, [], 21); // belt sets 21 but score already 22
    expect(c.fleetingEffective).toBe(22);
    expect(c.kind).toBe('none');
  });

  it('flags an active buff as a (coloured) buff', () => {
    const c = classifyAbility(16, 0, [{ value: 4, kind: 'buff' }]); // Rage / Enlarge etc.
    expect(c.persistentEffective).toBe(16);
    expect(c.fleetingEffective).toBe(20);
    expect(c.kind).toBe('buff');
  });

  it('keeps the full effective value over a persistent base plus equipment', () => {
    // base 14 + ASI +2 = 16 persistent; belt sets 21 → effective 21, grey badge.
    const c = classifyAbility(14, 2, [], 21);
    expect(c.persistentEffective).toBe(16);
    expect(c.fleetingEffective).toBe(21);
    expect(c.kind).toBe('equipment');
  });

  it('lets a buff win the colour when both a buff and equipment apply', () => {
    const c = classifyAbility(15, 0, [
      { value: 1, kind: 'equipment' },
      { value: 2, kind: 'buff' }
    ]);
    expect(c.fleetingEffective).toBe(18);
    expect(c.kind).toBe('buff');
  });

  it('treats a negative buff (debuff) as a buff kind (red)', () => {
    const c = classifyAbility(16, 0, [{ value: -2, kind: 'buff' }]);
    expect(c.fleetingEffective).toBe(14);
    expect(c.kind).toBe('buff');
  });
});

describe('classifyAc', () => {
  it('shows no badge for plain armor + dex', () => {
    const c = classifyAc(16, []);
    expect(c.effective).toBe(16);
    expect(c.kind).toBe('none');
  });

  it('badges a shield as equipment (grey), not green — even with an ASI elsewhere', () => {
    // ASI is irrelevant to AC; the shield is the only AC contribution → grey.
    const c = classifyAc(16, [{ value: 2, kind: 'equipment' }]);
    expect(c.effective).toBe(18);
    expect(c.kind).toBe('equipment');
  });

  it('badges a temporary AC bonus (Shield spell / Bless) as a buff (green)', () => {
    const c = classifyAc(16, [{ value: 5, kind: 'buff' }]);
    expect(c.effective).toBe(21);
    expect(c.kind).toBe('buff');
  });

  it('lets a buff win the colour over equipment', () => {
    const c = classifyAc(16, [
      { value: 2, kind: 'equipment' },
      { value: 1, kind: 'buff' }
    ]);
    expect(c.effective).toBe(19);
    expect(c.kind).toBe('buff');
  });
});
