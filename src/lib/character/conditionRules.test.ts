import { describe, it, expect } from 'vitest';
import { pickConditionRule, conditionRuleMap } from './conditionRules.js';
import type { NamedEntry } from '../data/catalog.js';

const entries: NamedEntry[] = [
  { name: 'Blinded', source: 'PHB', entries: ["A blinded creature can't see…"] },
  { name: 'Blinded', source: 'XPHB', entries: ['While you have the Blinded condition…'] },
  { name: 'Charmed', source: 'PHB', entries: ["A charmed creature can't attack…"] },
  { name: 'Grappled', source: 'HomebrewX', entries: ['Held fast.'] },
  { name: 'Deafened', source: 'XPHB', entries: [] } // present but says nothing
];

describe('pickConditionRule', () => {
  it('prefers the 2024 wording, since that is the edition the sheet follows', () => {
    expect(pickConditionRule(entries, 'Blinded')?.source).toBe('XPHB');
  });

  it('falls back to 2014 when there is no 2024 printing', () => {
    expect(pickConditionRule(entries, 'Charmed')?.source).toBe('PHB');
  });

  it('takes whatever carries it when neither core book does', () => {
    expect(pickConditionRule(entries, 'Grappled')?.source).toBe('HomebrewX');
  });

  it('matches regardless of case', () => {
    expect(pickConditionRule(entries, 'blinded')?.name).toBe('Blinded');
  });

  // An entry with no text is worse than nothing: it would open an empty tooltip.
  it('ignores an entry with no rules text', () => {
    expect(pickConditionRule(entries, 'Deafened')).toBeNull();
  });

  it('returns null for a condition the catalog does not have', () => {
    expect(pickConditionRule(entries, 'Exhaustion')).toBeNull();
    expect(pickConditionRule([], 'Blinded')).toBeNull();
  });
});

describe('conditionRuleMap', () => {
  it('keys by lowercased name, one entry per condition', () => {
    const map = conditionRuleMap(entries);
    expect([...map.keys()].sort()).toEqual(['blinded', 'charmed', 'grappled']);
    expect(map.get('blinded')?.source).toBe('XPHB');
  });

  it('is empty without a dataset, rather than throwing', () => {
    expect(conditionRuleMap([]).size).toBe(0);
  });
});
