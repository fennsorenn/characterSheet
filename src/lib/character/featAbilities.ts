import { ABILITIES, ABILITY_NAMES, type Ability } from './abilities.js';
import type { Character, CharacterModifier } from './schema.js';
import { allFeatRefs } from './schema.js';
import type { NamedEntry } from '../data/catalog.js';

/**
 * Half-feat ability bonuses — a feat's `ability` block (Resilient's +1 Con,
 * Fey Touched's +1 to one of Int/Wis/Cha, Actor's +1 Cha, …).
 *
 * Fixed bonuses (`{con: 1}`) apply automatically. `choose` blocks
 * (`{choose: {from, amount, count}}`) are surfaced as constrained pickers; the
 * player's pick is stored in `abilityChoices` under a namespaced key so the
 * generic ASI path leaves it alone. Both are gated on the feat being currently
 * held, so removing the feat drops the bonus.
 */

export const FEAT_ABILITY_PREFIX = 'feat-ability:';

/** Storage key for a feat's i-th `choose` ability block. */
export function featAbilityKey(featName: string, featSource: string, index: number): string {
  return `${FEAT_ABILITY_PREFIX}${featName}|${featSource}|${index}`;
}

/** A `choose` ability block awaiting the player's pick(s). */
export interface FeatAbilityChoice {
  key: string;
  featName: string;
  /** Abilities the bonus may be applied to. */
  from: Ability[];
  /** Bonus added to each chosen ability. */
  amount: number;
  /** How many distinct abilities to choose. */
  count: number;
  label: string;
}

type GetFeat = (name: string, source: string) => NamedEntry | undefined;
const isAbility = (s: unknown): s is Ability => (ABILITIES as readonly string[]).includes(s as string);

function abilityBlocks(ref: { name: string; source: string }, getFeat: GetFeat): unknown[] {
  const feat = getFeat(ref.name, ref.source);
  return Array.isArray(feat?.ability) ? (feat!.ability as unknown[]) : [];
}

function describe(from: Ability[], amount: number, count: number): string {
  const names = from.map((a) => ABILITY_NAMES[a].slice(0, 3)).join('/');
  const who = count > 1 ? `${count} of ${names}` : names;
  return `+${amount} to ${who}`;
}

/** Fixed and chosen feat ability bonuses as score modifiers, by feat. */
export function featAbilityModifiers(character: Character, getFeat: GetFeat): CharacterModifier[] {
  const out: CharacterModifier[] = [];
  for (const ref of allFeatRefs(character)) {
    abilityBlocks(ref, getFeat).forEach((blk, i) => {
      if (!blk || typeof blk !== 'object' || (blk as { hidden?: boolean }).hidden) return;
      if ('choose' in (blk as object)) {
        const picks = character.abilityChoices[featAbilityKey(ref.name, ref.source, i)] ?? {};
        for (const a of ABILITIES) {
          const v = picks[a];
          if (typeof v === 'number' && v !== 0) out.push({ target: `ability.${a}.score`, source: ref.name, value: v });
        }
      } else {
        for (const a of ABILITIES) {
          const v = (blk as Record<string, unknown>)[a];
          if (typeof v === 'number' && v !== 0) out.push({ target: `ability.${a}.score`, source: ref.name, value: v });
        }
      }
    });
  }
  return out;
}

/** The `choose` ability blocks across the character's feats, for the picker UI. */
export function featAbilityChoices(character: Character, getFeat: GetFeat): FeatAbilityChoice[] {
  const out: FeatAbilityChoice[] = [];
  for (const ref of allFeatRefs(character)) {
    abilityBlocks(ref, getFeat).forEach((blk, i) => {
      if (!blk || typeof blk !== 'object' || (blk as { hidden?: boolean }).hidden) return;
      const choose = (blk as { choose?: unknown }).choose;
      if (!choose || typeof choose !== 'object') return;
      const c = choose as { from?: unknown; amount?: unknown; count?: unknown };
      const from = (Array.isArray(c.from) ? c.from : []).filter(isAbility);
      if (!from.length) return;
      const amount = typeof c.amount === 'number' ? c.amount : 1;
      const count = typeof c.count === 'number' ? c.count : 1;
      out.push({
        key: featAbilityKey(ref.name, ref.source, i),
        featName: ref.name,
        from,
        amount,
        count,
        label: describe(from, amount, count)
      });
    });
  }
  return out;
}
