export {
  ABILITIES,
  ABILITY_NAMES,
  SKILLS,
  SKILL_ABILITY,
  PROFICIENCY_MULTIPLIER,
  type Ability,
  type Skill,
  type ProficiencyLevel
} from './abilities.js';
export {
  CHARACTER_SCHEMA_VERSION,
  createCharacter,
  totalLevel,
  allFeatRefs,
  emptySpellSlots,
  type Character,
  type ClassEntry,
  type CatalogRef,
  type InventoryItem,
  type SpellRef,
  type CharacterModifier,
  type Resource,
  type RestType,
  type SpellSlotLevel,
  type SpellStatus,
  spellStatus,
  type Buff,
  type BuffModifier,
  type HitDicePool,
  type NoteDoc,
  type NoteFolder,
  type NoteNode,
  isNoteFolder
} from './schema.js';
export { applyRest } from './rest.js';
export { applyAdjustment, adjustmentValue } from './adjustments.js';
export {
  hpGainAverage,
  hpGainRoll,
  totalHpGain,
  conModifier,
  applyLevelUp,
  spendHitDie,
  recoverHitDice,
  type LevelUpPlan
} from './levelup.js';
export {
  CONDITIONS,
  buffModifiers,
  exhaustionModifiers,
  effectModifiers
} from './effects.js';
export { buildGraph, skillNodeId } from './buildGraph.js';
export {
  computeEquipmentEffects,
  weaponAttacks,
  weaponProficiencySet,
  type CatalogLookup,
  type EquipmentEffects,
  type WeaponAttack
} from './equipment.js';
export { iconForItem, slotIcon, iconForSchool, iconForDamageType, iconLabel } from './itemIcons.js';
export { spellTags, conditionIcon, type SpellTag } from './spellTags.js';
export {
  attachedSpellNames,
  grantedSpellsFromItems,
  type GrantedSpell
} from './grantedSpells.js';
export {
  resolveFeatures,
  featureGrantedSpells,
  additionalSpellNames,
  type Feature,
  type FeatureGroup
} from './features.js';
export { asiModifiers, asiTotal } from './abilityChoices.js';
export {
  gatherGrants,
  grantNumericModifiers,
  grantKey,
  setMembers,
  maxNumeric,
  universeMembers,
  memberLabel,
  GRANT_PREFIX,
  DAMAGE_TYPES,
  type GrantPool,
  type GrantChoice,
  type SetGrant,
  type NumericGrant,
  type SetCategory,
  type Universe
} from './grants.js';
export {
  countAtLevel,
  featureOptionalProgressions,
  optionalFeaturesOfType,
  type OptionalProgression
} from './optionalChoices.js';
export {
  featureChoices,
  blockSpellChoices,
  spellMatchesChoice,
  choiceGrantedSpells,
  parseChoiceFilter,
  choiceLabel,
  type ChoiceFilter,
  type FeatureChoices,
  type SpellChoiceField,
  type OptionChoice
} from './spellChoices.js';
export { ATTUNEMENT_LIMIT } from './schema.js';
export {
  casterClasses,
  assignSpellCounts,
  evalPreparedFormula,
  type CasterClass,
  type CasterKind,
  type ClassSpellCount
} from './spellcasting.js';
export { spellSlotInfo, type SpellSlotInfo } from './spellSlots.js';
export {
  featureResources,
  resetFeatureResources,
  type FeatureResource
} from './featureResources.js';
export { labelForNode } from './labels.js';
