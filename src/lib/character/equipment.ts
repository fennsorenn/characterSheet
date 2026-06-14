import type { NamedEntry } from '../data/catalog.js';
import { ABILITIES, SKILLS, skillNodeId } from './abilities.js';
import type { Character, CharacterModifier } from './schema.js';

/**
 * Maps equipped catalog items to mechanical effects on the calc graph.
 *
 * This is what makes equipping armor change AC and a Ring of Protection bump
 * both AC and saves — all flowing through the same introspectable modifier
 * system, so the "explain" popover shows the item as the source. It is a pure
 * function of the character plus a catalog lookup; no data is baked into the
 * character document.
 */

/** Minimal read access into the catalog, so we don't depend on the search index. */
export interface CatalogLookup {
  getItem(name: string, source: string): NamedEntry | undefined;
}

export interface EquipmentEffects {
  /** Base AC contributed by worn armor (undefined = no armor, use unarmored base). */
  acArmor?: number;
  /** Dex cap for the AC calc (99 = uncapped, 2 = medium, 0 = heavy/no dex). */
  acMaxDex?: number;
  modifiers: CharacterModifier[];
}

/** Dexterity contribution cap by armor category. */
const DEX_CAP: Record<string, number> = { LA: 99, MA: 2, HA: 0 };

/** 5e items tag bonuses as strings like "+1"; coerce to a number. */
function parseBonus(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = parseInt(value, 10);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

/** Item type codes carry a source suffix ("HA|XPHB"); take the bare code. */
function baseType(type: unknown): string {
  return typeof type === 'string' ? type.split('|')[0] : '';
}

export function computeEquipmentEffects(
  character: Character,
  lookup: CatalogLookup
): EquipmentEffects {
  const modifiers: CharacterModifier[] = [];
  let acArmor: number | undefined;
  let acMaxDex: number | undefined;

  for (const inv of character.inventory) {
    if (!inv.equipped) continue;
    const item = lookup.getItem(inv.name, inv.source);
    if (!item) continue;

    const type = baseType(item.type);
    if (type === 'LA' || type === 'MA' || type === 'HA') {
      // Worn armor sets the AC base and dex cap (last equipped armor wins).
      if (typeof item.ac === 'number') {
        acArmor = item.ac;
        acMaxDex = DEX_CAP[type];
      }
    } else if (type === 'S') {
      // Shields add their AC value (typically +2) on top.
      modifiers.push({
        target: 'ac',
        source: item.name,
        value: typeof item.ac === 'number' ? item.ac : 2
      });
    }

    // Magic bonuses can coexist with the item's armor role (e.g. +1 Plate).
    pushBonus(modifiers, item, 'bonusAc', ['ac']);
    pushBonus(
      modifiers,
      item,
      'bonusSavingThrow',
      ABILITIES.map((a) => `save.${a}`)
    );
    pushBonus(modifiers, item, 'bonusSpellAttack', ['spell.attack']);
    pushBonus(modifiers, item, 'bonusSpellSaveDc', ['spell.dc']);
    pushBonus(modifiers, item, 'bonusProficiencyBonus', ['prof.bonus']);
    pushBonus(
      modifiers,
      item,
      'bonusAbilityCheck',
      SKILLS.map((s) => skillNodeId(s))
    );
  }

  return { acArmor, acMaxDex, modifiers };
}

function pushBonus(
  modifiers: CharacterModifier[],
  item: NamedEntry,
  field: string,
  targets: string[]
): void {
  const raw = item[field];
  if (raw === undefined || raw === null) return;
  const value = parseBonus(raw);
  if (value === 0) return;
  for (const target of targets) {
    modifiers.push({ target, source: item.name, value });
  }
}
