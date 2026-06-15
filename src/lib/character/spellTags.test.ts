import { describe, it, expect } from 'vitest';
import { spellTags, conditionIcon } from './spellTags.js';
import type { NamedEntry } from '../data/catalog.js';

const ids = (s: NamedEntry) => spellTags(s).map((t) => t.id);

describe('spellTags', () => {
  it('tags a damaging AoE save spell (Fireball)', () => {
    const fireball: NamedEntry = {
      name: 'Fireball',
      source: 'PHB',
      school: 'V',
      damageInflict: ['fire'],
      savingThrow: ['dexterity'],
      areaTags: ['S']
    };
    const t = ids(fireball);
    expect(t).toContain('school:V');
    expect(t).toContain('damage:fire');
    expect(t).toContain('prop:save');
    expect(t).toContain('prop:area');
    expect(t).not.toContain('prop:single');
  });

  it('tags an attack-roll single-target spell (Fire Bolt)', () => {
    const t = ids({
      name: 'Fire Bolt',
      source: 'PHB',
      school: 'V',
      damageInflict: ['fire'],
      spellAttack: ['R'],
      areaTags: ['ST']
    });
    expect(t).toContain('prop:attack');
    expect(t).toContain('prop:single');
    expect(t).not.toContain('prop:save');
  });

  it('tags healing, concentration, and ritual', () => {
    const t = ids({
      name: 'Aid',
      source: 'PHB',
      school: 'A',
      miscTags: ['HL'],
      duration: [{ concentration: true } as never],
      meta: { ritual: true } as never
    });
    expect(t).toContain('prop:heal');
    expect(t).toContain('prop:conc');
    expect(t).toContain('prop:ritual');
  });

  it('tags inflicted conditions, with a generic fallback', () => {
    const t = spellTags({
      name: 'Hold + Daze',
      source: 'X',
      school: 'E',
      conditionInflict: ['restrained', 'stunned'] // stunned has no specific icon
    });
    const restrained = t.find((x) => x.id === 'cond:restrained')!;
    const stunned = t.find((x) => x.id === 'cond:stunned')!;
    expect(restrained.icon).toBe('restrained');
    expect(stunned.icon).toBe('affliction'); // fallback
  });

  it('maps poisoned to the poison icon and unknown conditions to affliction', () => {
    expect(conditionIcon('poisoned')).toBe('poison');
    expect(conditionIcon('frightened')).toBe('frightened');
    expect(conditionIcon('deafened')).toBe('affliction');
  });
});
