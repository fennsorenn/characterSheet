import { abilityModifier } from '../calc/index.js';
import type { NamedEntry } from '../data/catalog.js';
import { ABILITIES, SKILLS, skillNodeId, type Ability } from './abilities.js';
import type { Character, CharacterModifier, InventoryItem } from './schema.js';

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
  /** Ability scores set to a fixed value by an item (Belt of Giant Strength). */
  abilitySets: Partial<Record<Ability, AbilitySet>>;
}

/** An item setting an ability score to a fixed value, with its source. */
export interface AbilitySet {
  value: number;
  source: string;
  /** An emoji hinting at the source (equipment slot, or generic magic). */
  icon: string;
}

/** Pick an icon for an item by equipment slot, falling back to generic magic. */
export function itemIcon(item: NamedEntry): string {
  const name = item.name.toLowerCase();
  const type = baseType(item.type);
  if (type === 'RG' || /\bring\b/.test(name)) return '💍';
  if (/belt|girdle|sash/.test(name)) return '🎗️';
  if (/helm|circlet|crown|\bhat\b|\bcap\b|hood|headband|mask|goggles|lenses|eyes/.test(name)) return '🎩';
  if (/amulet|necklace|periapt|medallion|talisman|pendant|brooch|scarab|torc/.test(name)) return '📿';
  if (/gauntlet|glove/.test(name)) return '🧤';
  if (/boots|slippers|shoes|sandals|footsteps/.test(name)) return '👢';
  if (/cloak|cape|mantle|robe/.test(name)) return '🧥';
  if (/bracers|bracelet|armband|vambrace/.test(name)) return '💪';
  if (type === 'WD' || type === 'RD' || /\bwand\b|\brod\b|\bstaff\b/.test(name)) return '🪄';
  return '✨';
}

/** A computed weapon attack for an equipped weapon. */
export interface WeaponAttack {
  id: string;
  name: string;
  ability: Ability;
  proficient: boolean;
  /** Magic bonus to the attack roll (separate from ability/proficiency). */
  attackBonus: number;
  damageDice: string;
  /** Magic bonus added to the damage roll (ability mod comes from the graph). */
  damageBonus: number;
  damageType: string;
  versatileDice?: string;
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
  const abilitySets: Partial<Record<Ability, AbilitySet>> = {};
  let acArmor: number | undefined;
  let acMaxDex: number | undefined;

  for (const inv of character.inventory) {
    if (!inv.equipped) continue;
    const item = lookup.getItem(inv.name, inv.source);
    if (!item) continue;

    const type = baseType(item.type);
    if (type === 'LA' || type === 'MA' || type === 'HA') {
      // Worn armor sets the AC base and dex cap (last equipped armor wins).
      // Mundane armor works unattuned; only the magic bonus is gated below.
      if (typeof item.ac === 'number') {
        acArmor = item.ac;
        acMaxDex = DEX_CAP[type];
      }
    } else if (type === 'S') {
      modifiers.push({
        target: 'ac',
        source: item.name,
        value: typeof item.ac === 'number' ? item.ac : 2
      });
    }

    // Magic effects (bonuses, score-setting) require attunement if the item does.
    if (!isMagicActive(item, inv)) continue;

    pushBonus(modifiers, item, 'bonusAc', ['ac']);
    pushBonus(modifiers, item, 'bonusSavingThrow', ABILITIES.map((a) => `save.${a}`));
    pushBonus(modifiers, item, 'bonusSpellAttack', ['spell.attack']);
    pushBonus(modifiers, item, 'bonusSpellSaveDc', ['spell.dc']);
    pushBonus(modifiers, item, 'bonusProficiencyBonus', ['prof.bonus']);
    pushBonus(modifiers, item, 'bonusAbilityCheck', SKILLS.map((s) => skillNodeId(s)));

    // Items that set an ability score to a fixed value (no effect if already higher).
    const statics = (item.ability as { static?: Record<string, number> } | undefined)?.static;
    if (statics) {
      for (const a of ABILITIES) {
        if (typeof statics[a] === 'number' && statics[a] > (abilitySets[a]?.value ?? 0)) {
          abilitySets[a] = { value: statics[a], source: item.name, icon: itemIcon(item) };
        }
      }
    }
  }

  return { acArmor, acMaxDex, modifiers, abilitySets };
}

/** Magic effects apply when the item needs no attunement, or is attuned. */
function isMagicActive(item: NamedEntry, inv: InventoryItem): boolean {
  return !item.reqAttune || inv.attuned === true;
}

const DMG_TYPES: Record<string, string> = { S: 'slashing', P: 'piercing', B: 'bludgeoning' };

/**
 * Compute attack entries for every equipped weapon. The attack/damage ability is
 * chosen by 5e rules (ranged → Dex, finesse → better of Str/Dex, else Str); the
 * actual to-hit/damage numbers are calc-graph nodes so they stay introspectable.
 */
export function weaponAttacks(character: Character, lookup: CatalogLookup): WeaponAttack[] {
  const out: WeaponAttack[] = [];
  character.inventory.forEach((inv, index) => {
    if (!inv.equipped) return;
    const item = lookup.getItem(inv.name, inv.source);
    if (!item || !isWeapon(item)) return;

    const ability = chooseAbility(item, character);
    const magic = isMagicActive(item, inv);
    const attackBonus = magic
      ? parseBonus(item.bonusWeapon) + parseBonus(item.bonusWeaponAttack)
      : 0;
    const damageBonus = magic
      ? parseBonus(item.bonusWeapon) + parseBonus(item.bonusWeaponDamage)
      : 0;
    const property = Array.isArray(item.property) ? (item.property as string[]) : [];

    out.push({
      id: `w${index}`,
      name: item.name,
      ability,
      proficient: inv.proficient !== false,
      attackBonus,
      damageDice: typeof item.dmg1 === 'string' ? item.dmg1 : '—',
      damageBonus,
      damageType: DMG_TYPES[baseType(item.dmgType)] ?? '',
      versatileDice:
        property.includes('V') && typeof item.dmg2 === 'string' ? item.dmg2 : undefined
    });
  });
  return out;
}

function isWeapon(item: NamedEntry): boolean {
  const type = baseType(item.type);
  return (type === 'M' || type === 'R') && typeof item.dmg1 === 'string';
}

function chooseAbility(item: NamedEntry, character: Character): Ability {
  const type = baseType(item.type);
  const property = Array.isArray(item.property) ? (item.property as string[]) : [];
  if (type === 'R') return 'dex';
  if (property.includes('F')) {
    return abilityModifier(character.abilities.dex) > abilityModifier(character.abilities.str)
      ? 'dex'
      : 'str';
  }
  return 'str';
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
