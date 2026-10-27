import { describe, it, expect } from 'vitest';
import { createCharacter, currencyOf, hasCoins, emptyCurrency, COINS } from './schema.js';

describe('currency', () => {
  it('reads as an empty purse when the document has never held coins', () => {
    const c = createCharacter({});
    expect(c.currency).toBeUndefined();
    expect(currencyOf(c)).toEqual(emptyCurrency());
    expect(hasCoins(c)).toBe(false);
  });

  it('fills in denominations a partial record omits', () => {
    // Documents written by an importer may carry only what the source had.
    const c = createCharacter({ currency: { gp: 24, sp: 8, cp: 10 } as never });
    expect(currencyOf(c)).toEqual({ pp: 0, gp: 24, ep: 0, sp: 8, cp: 10 });
    expect(hasCoins(c)).toBe(true);
  });

  it('counts a purse holding only the smallest coin as non-empty', () => {
    expect(hasCoins(createCharacter({ currency: { ...emptyCurrency(), cp: 1 } }))).toBe(true);
  });

  it('orders denominations richest first, as sheets print them', () => {
    expect([...COINS]).toEqual(['pp', 'gp', 'ep', 'sp', 'cp']);
  });

  it('survives a round trip through createCharacter', () => {
    const coins = { pp: 1, gp: 2, ep: 3, sp: 4, cp: 5 };
    expect(createCharacter({ currency: coins }).currency).toEqual(coins);
  });
});
