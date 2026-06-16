import { writable, derived, get } from 'svelte/store';
import {
  ABILITIES,
  applyRest,
  applyAdjustment,
  adjustmentValue,
  applyLevelUp,
  asiModifiers,
  buffModifiers,
  exhaustionModifiers,
  grantNumericModifiers,
  spendHitDie as spendHitDiePure,
  ATTUNEMENT_LIMIT,
  buildGraph,
  computeEquipmentEffects,
  iconForItem,
  createCharacter,
  gatherGrants,
  spellSlotInfo,
  featureResources,
  type FeatureResource,
  type Ability,
  type Buff,
  type CatalogRef,
  type Character,
  type GrantPool,
  type LevelUpPlan,
  type NoteDoc,
  type NoteFolder,
  type NoteNode,
  isNoteFolder,
  type ProficiencyLevel,
  type Resource,
  type RestType,
  type Skill,
  type SpellStatus
} from '../character/index.js';
import {
  classifyAbility,
  classifyAc,
  type FleetingContribution,
  type AcContribution,
  type OverrideKind
} from '../character/overrides.js';
import { catalogLookup, catalogState } from './catalog.js';
import { loadLocal, saveLocal } from './characters.js';
import { apiGetCharacter, apiPutCharacter } from '../api/client.js';

const EMPTY_POOL: GrantPool = { numeric: [], sets: [], choices: [] };

/**
 * Reactive character document + its derived calc graph.
 *
 * The graph is `derived` from the character, so any edit transparently rebuilds
 * every dependent number (and its explanation). Edits are small helpers that
 * produce a new document object — keeping the door open for undo/redo later.
 * The document is mirrored to localStorage so a refresh keeps your character.
 */

const store = writable<Character>(createCharacter());

/**
 * Where the active character is persisted: a local (localStorage) library entry
 * or a logged-in user's server record. Set via openLocalCharacter /
 * openUserCharacter; edits then autosave to that source.
 */
export type CharacterRef = { scope: 'local' | 'user'; slug: string } | null;
let activeRef: CharacterRef = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

store.subscribe((c) => {
  if (!activeRef) return;
  if (activeRef.scope === 'local') {
    saveLocal(activeRef.slug, c.name, c);
  } else {
    const slug = activeRef.slug;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => apiPutCharacter(slug, c.name, c).catch(() => {}), 500);
  }
});

/** Load a character into the editor and bind autosave to a source. */
function setActive(ref: CharacterRef, doc: Character | null) {
  activeRef = null; // suppress the save triggered by loading
  store.set(createCharacter(doc ?? {}));
  activeRef = ref;
}

export function openLocalCharacter(slug: string): boolean {
  const doc = loadLocal(slug);
  setActive({ scope: 'local', slug }, doc);
  return !!doc;
}
export async function openUserCharacter(slug: string): Promise<boolean> {
  const res = await apiGetCharacter(slug).catch(() => ({ doc: undefined }));
  setActive({ scope: 'user', slug }, res.doc ?? null);
  return !!res.doc;
}
/** Stop autosaving (e.g. when leaving a sheet for an overview). */
export function detachCharacter() {
  activeRef = null;
}

/**
 * The live calc graph; recomputed when the character *or* the catalog changes,
 * so equipping a catalog item updates derived numbers (and their explanations).
 */
/** The unified feature-grant pool (proficiencies, resistances, ability bonuses, …). */
export const grantPool = derived([store, catalogState], ([$c, $cat]) =>
  $cat.catalog ? gatherGrants($c, $cat.catalog) : EMPTY_POOL
);

export const graph = derived([store, catalogLookup, grantPool], ([$c, $lookup, $grants]) =>
  buildGraph($c, $lookup, $grants)
);

/** Spell slots computed from class levels (multiclass table + Warlock pact). */
export const computedSlots = derived([store, catalogState], ([$c, $cat]) =>
  $cat.catalog ? spellSlotInfo($c, $cat.catalog) : { slots: [0, 0, 0, 0, 0, 0, 0, 0, 0], pact: null }
);

/** Implicit class/subclass resource pools (Channel Divinity, Rage, …) with uses. */
export const featureResourceList = derived([store, catalogState, graph], ([$c, $cat, $g]) =>
  (
    $cat.catalog
      ? featureResources(
          $c,
          $cat.catalog,
          (a) => ($g.has(`ability.${a}.mod`) ? $g.get(`ability.${a}.mod`) : 0),
          $g.has('prof.bonus') ? $g.get('prof.bonus') : 2
        )
      : []
  ).map((r): FeatureResource & { used: number } => ({ ...r, used: Math.min($c.featureResourceUsed[r.key] ?? 0, r.max) }))
);

/** Set spent uses of an implicit feature resource (clamped to [0, max]). */
export function setFeatureResourceUsed(key: string, used: number, max: number) {
  update((c) => {
    const featureResourceUsed = { ...c.featureResourceUsed };
    const v = Math.min(Math.max(0, used), max);
    if (v === 0) delete featureResourceUsed[key];
    else featureResourceUsed[key] = v;
    return { ...c, featureResourceUsed };
  });
}

/**
 * Per-ability score override, shown ONLY when a FLEETING effect (equipment or a
 * buff) contributes. Persistent build changes (ASIs, feat/racial ability grants)
 * do NOT produce an override — they read as the character's own score, surfaced
 * via `persistentEffective` on {@link abilityScores} instead.
 *
 * `kind` picks the badge flavour: 'buff' → coloured (green up / red down),
 * 'equipment' → neutral grey badge with normal-colour text.
 */
export interface AbilityOverride {
  /** The raw editable base score (the field shown underneath). */
  base: number;
  /** The full effective score (base + persistent + fleeting) — what we display. */
  effective: number;
  source: string;
  icon: string;
  /** Signed delta of the FLEETING part (drives green/red for buffs). */
  delta: number;
  kind: 'buff' | 'equipment';
}

/** The persistent ("character build") effective score per ability — base + ASI/grants. */
export const abilityScores = derived([store, catalogLookup, grantPool], ([$c, $lookup, $grants]) => {
  void $lookup; // keep deps aligned with the override store below
  const out = {} as Record<Ability, number>;
  const persistent = persistentAbilityDeltas($c, $grants);
  for (const a of ABILITIES) out[a] = $c.abilities[a] + persistent[a];
  return out;
});

/** Summed PERSISTENT ability deltas (ASIs + ability-targeting grant numerics). */
function persistentAbilityDeltas($c: Character, $grants: GrantPool): Record<Ability, number> {
  const out = {} as Record<Ability, number>;
  for (const a of ABILITIES) out[a] = 0;
  const add = (target: string, value: number) => {
    for (const a of ABILITIES) if (target === `ability.${a}.score`) out[a] += value;
  };
  for (const m of asiModifiers($c)) add(m.target, m.value);
  for (const m of grantNumericModifiers($grants)) add(m.target, m.value);
  return out;
}

/**
 * An ability emits an override ONLY when a fleeting effect contributes — i.e. the
 * full effective score differs from the persistent (build) score. The badge icon
 * is the item's slot icon for an equipment set, else a generic boost icon, and
 * the tooltip lists the contributing fleeting sources.
 */
export const abilityOverrides = derived([store, catalogLookup, grantPool], ([$c, $lookup, $grants]) => {
  const equip = computeEquipmentEffects($c, $lookup);
  const persistent = persistentAbilityDeltas($c, $grants);
  // Fleeting modifiers: equipment item bonuses + active buffs + exhaustion.
  const fleetingMods = [...buffModifiers($c), ...exhaustionModifiers($c)].map((m) => ({
    ...m,
    kind: 'buff' as const
  }));
  const equipMods = equip.modifiers.map((m) => ({ ...m, kind: 'equipment' as const }));
  const out = {} as Partial<Record<Ability, AbilityOverride>>;

  for (const a of ABILITIES) {
    const base = $c.abilities[a];
    const node = `ability.${a}.score`;
    const fleeting: FleetingContribution[] = [];
    for (const m of [...equipMods, ...fleetingMods]) {
      if (m.target === node) fleeting.push({ value: m.value, kind: m.kind });
    }
    const set = equip.abilitySets[a];
    const c = classifyAbility(base, persistent[a], fleeting, set?.value);
    if (c.kind === 'none') continue;

    const sources = new Set<string>();
    if (set && c.fleetingEffective === set.value) sources.add(set.source);
    for (const m of [...equipMods, ...fleetingMods]) if (m.target === node) sources.add(m.source);
    // Icon: a set item's slot icon, else the slot icon of the contributing
    // equipment item (e.g. Belt of Dwarvenkind → waist), else a generic boost.
    const equipSource = equipMods.find((m) => m.target === node)?.source;
    const icon =
      c.kind !== 'equipment'
        ? 'advantage'
        : set
          ? set.icon
          : equipSource
            ? iconForItem({ name: equipSource })
            : 'shield';
    out[a] = {
      base,
      effective: c.fleetingEffective,
      delta: c.fleetingEffective - c.persistentEffective,
      source: [...sources].join(', ') || 'Effect',
      icon,
      kind: c.kind
    };
  }
  return out;
});

/** Armor-Class override: a badge for shield/equipment (grey) or a buff (green). */
export interface AcOverride {
  /** Full effective AC, shown in place of the plain value when badged. */
  effective: number;
  source: string;
  icon: string;
  delta: number;
  kind: 'buff' | 'equipment';
}

export const acOverride = derived([store, catalogLookup, grantPool, graph], ([$c, $lookup, $grants, $g]) => {
  void $grants;
  if (!$g.has('ac')) return undefined;
  const equip = computeEquipmentEffects($c, $lookup);
  const equipAcSources = new Set(equip.modifiers.filter((m) => m.target === 'ac').map((m) => m.source));
  // baseEffective = AC from armor + dex, before any layered modifier.
  const explain = $g.explain('ac');
  const applied = explain.modifiers.filter((m) => m.applied);
  const baseEffective = explain.value - applied.reduce((s, m) => s + m.value, 0);

  const contributions: AcContribution[] = [];
  const sources = new Set<string>();
  let icon = 'shield';
  for (const m of applied) {
    const isEquipment = equipAcSources.has(m.source);
    contributions.push({ value: m.value, kind: isEquipment ? 'equipment' : 'buff' });
    sources.add(m.source);
  }
  const c = classifyAc(baseEffective, contributions);
  if (c.kind === 'none') return undefined;
  if (c.kind === 'buff') icon = 'advantage';
  return {
    effective: c.effective,
    delta: c.effective - c.baseEffective,
    source: [...sources].join(', ') || 'Effect',
    icon,
    kind: c.kind
  } satisfies AcOverride;
});

export type { OverrideKind };

export const character = { subscribe: store.subscribe };

function update(fn: (c: Character) => Character) {
  store.update(fn);
}

export function setAbilityScore(ability: Ability, score: number) {
  update((c) => ({ ...c, abilities: { ...c.abilities, [ability]: score } }));
}

export function setClassLevel(index: number, level: number) {
  update((c) => {
    const classes = c.classes.map((cl, i) =>
      i === index ? { ...cl, level: Math.max(1, level) } : cl
    );
    return { ...c, classes };
  });
}

/** Add a class from the catalog (multiclass), with its hit die. Deduped by name+source. */
export function addClass(entry: { name: string; source: string; hitDie?: number }) {
  update((c) =>
    c.classes.some((cl) => cl.name === entry.name && cl.source === entry.source)
      ? c
      : {
          ...c,
          classes: [...c.classes, { name: entry.name, source: entry.source, level: 1, hitDie: entry.hitDie }]
        }
  );
}

/** Remove a class entry (and its subclass) by index. */
export function removeClass(index: number) {
  update((c) => ({ ...c, classes: c.classes.filter((_, i) => i !== index) }));
}

export function setName(name: string) {
  update((c) => ({ ...c, name }));
}

// --- Race / background / feats / subclass ---

export function setRace(race: CatalogRef | undefined) {
  update((c) => ({ ...c, race }));
}
export function setBackground(background: CatalogRef | undefined) {
  update((c) => ({ ...c, background }));
}
export function addFeat(feat: CatalogRef) {
  update((c) =>
    c.feats.some((f) => f.name === feat.name && f.source === feat.source)
      ? c
      : { ...c, feats: [...c.feats, feat] }
  );
}
export function removeFeat(index: number) {
  update((c) => ({ ...c, feats: c.feats.filter((_, n) => n !== index) }));
}
export function setSubclass(classIndex: number, subclass: string | undefined) {
  update((c) => ({
    ...c,
    classes: c.classes.map((cl, i) => (i === classIndex ? { ...cl, subclass } : cl))
  }));
}

/** Set or clear a "choose a spell" feature pick, keyed by its choice slot. */
export function setSpellChoice(key: string, spell: CatalogRef | undefined) {
  update((c) => {
    const spellChoices = { ...c.spellChoices };
    if (spell) spellChoices[key] = spell;
    else delete spellChoices[key];
    return { ...c, spellChoices };
  });
}

/** Set or clear the ability increases for an ASI feature. */
export function setAbilityChoice(key: string, increases: Partial<Record<Ability, number>> | undefined) {
  update((c) => {
    const abilityChoices = { ...c.abilityChoices };
    if (increases && Object.keys(increases).length > 0) abilityChoices[key] = increases;
    else delete abilityChoices[key];
    return { ...c, abilityChoices };
  });
}

/** Pick the option for a multi-block feature (e.g. Magic Initiate's class). */
export function setFeatureOption(key: string, value: string | undefined) {
  update((c) => {
    const featureOptions = { ...c.featureOptions };
    if (value) featureOptions[key] = value;
    else delete featureOptions[key];
    return { ...c, featureOptions };
  });
}

/** Set or clear the picked members for a set-valued grant choose block. */
export function setGrantChoice(key: string, members: string[]) {
  update((c) => {
    const grantChoices = { ...c.grantChoices };
    if (members.length) grantChoices[key] = members;
    else delete grantChoices[key];
    return { ...c, grantChoices };
  });
}

/** Set or clear the feat taken in an ASI-or-feat slot. */
export function setFeatChoice(key: string, ref: CatalogRef | undefined) {
  update((c) => {
    const featChoices = { ...c.featChoices };
    if (ref) featChoices[key] = ref;
    else delete featChoices[key];
    return { ...c, featChoices };
  });
}

/** Set or clear a picked optional feature (maneuver, invocation, …) for a slot. */
export function setOptionalChoice(key: string, ref: CatalogRef | undefined) {
  update((c) => {
    const optionalChoices = { ...c.optionalChoices };
    if (ref) optionalChoices[key] = ref;
    else delete optionalChoices[key];
    return { ...c, optionalChoices };
  });
}

// --- Feature meta: hidden / custom tags (keyed by `name|source`) ---

function mergeMeta(c: Character, key: string, patch: Partial<Character['featureMeta'][string]>): Character {
  const featureMeta = { ...c.featureMeta, [key]: { ...c.featureMeta[key], ...patch } };
  // Drop empty meta entries.
  const m = featureMeta[key];
  if (!m.hidden && (!m.tags || m.tags.length === 0)) delete featureMeta[key];
  return { ...c, featureMeta };
}

export function setFeatureHidden(key: string, hidden: boolean) {
  update((c) => mergeMeta(c, key, { hidden }));
}
export function addFeatureTag(key: string, tag: string) {
  update((c) => {
    const tags = c.featureMeta[key]?.tags ?? [];
    if (tags.includes(tag)) return c;
    return mergeMeta(c, key, { tags: [...tags, tag] });
  });
}
export function removeFeatureTag(key: string, tag: string) {
  update((c) => mergeMeta(c, key, { tags: (c.featureMeta[key]?.tags ?? []).filter((t) => t !== tag) }));
}

export function setAcBase(acBase: number) {
  update((c) => ({ ...c, acBase }));
}

export function toggleSaveProficiency(ability: Ability) {
  update((c) => {
    const has = c.saveProficiencies.includes(ability);
    const saveProficiencies = has
      ? c.saveProficiencies.filter((a) => a !== ability)
      : [...c.saveProficiencies, ability];
    return { ...c, saveProficiencies };
  });
}

/** Cycle a skill through none → proficient → expertise → none. */
export function cycleSkillProficiency(skill: Skill) {
  const order: ProficiencyLevel[] = ['none', 'proficient', 'expertise'];
  update((c) => {
    const current = c.skillProficiencies[skill] ?? 'none';
    const next = order[(order.indexOf(current) + 1) % order.length];
    const skillProficiencies = { ...c.skillProficiencies };
    if (next === 'none') delete skillProficiencies[skill];
    else skillProficiencies[skill] = next;
    return { ...c, skillProficiencies };
  });
}

// --- Inventory & spells (fed by quick import) ---

/** Add a catalog item to the inventory, or bump quantity if already held. */
export function addInventoryItem(ref: CatalogRef) {
  update((c) => {
    const idx = c.inventory.findIndex(
      (i) => i.name === ref.name && i.source === ref.source
    );
    if (idx >= 0) {
      const inventory = c.inventory.map((i, n) =>
        n === idx ? { ...i, quantity: i.quantity + 1 } : i
      );
      return { ...c, inventory };
    }
    return {
      ...c,
      inventory: [...c.inventory, { ...ref, quantity: 1, equipped: false }]
    };
  });
}

export function toggleEquipped(index: number) {
  update((c) => ({
    ...c,
    inventory: c.inventory.map((i, n) =>
      n === index ? { ...i, equipped: !i.equipped } : i
    )
  }));
}

export function setItemQuantity(index: number, quantity: number) {
  update((c) => ({
    ...c,
    inventory: c.inventory
      .map((i, n) => (n === index ? { ...i, quantity: Math.max(0, quantity) } : i))
      .filter((i) => i.quantity > 0)
  }));
}

export function removeInventoryItem(index: number) {
  update((c) => ({ ...c, inventory: c.inventory.filter((_, n) => n !== index) }));
}

/** Toggle attunement, refusing to exceed the attunement limit. */
export function toggleAttuned(index: number) {
  update((c) => {
    const item = c.inventory[index];
    if (!item) return c;
    const attuning = !item.attuned;
    const count = c.inventory.filter((i) => i.attuned).length;
    if (attuning && count >= ATTUNEMENT_LIMIT) return c; // at the limit
    return {
      ...c,
      inventory: c.inventory.map((i, n) => (n === index ? { ...i, attuned: attuning } : i))
    };
  });
}

export function setItemProficient(index: number, proficient: boolean) {
  update((c) => ({
    ...c,
    inventory: c.inventory.map((i, n) => (n === index ? { ...i, proficient } : i))
  }));
}

/** Add a spell to the known/prepared list, ignoring duplicates. */
export function addSpell(ref: CatalogRef) {
  update((c) => {
    if (c.spells.some((s) => s.name === ref.name && s.source === ref.source)) return c;
    return { ...c, spells: [...c.spells, { ...ref, status: 'known' as const }] };
  });
}

export function setSpellStatus(index: number, status: SpellStatus) {
  update((c) => ({
    ...c,
    spells: c.spells.map((s, n) =>
      n === index ? { ...s, status, prepared: undefined } : s
    )
  }));
}

/** Mark/unmark a spell as granted by a feature/item (sets the source label). */
export function setSpellGranted(index: number, grantedBy: string | undefined) {
  update((c) => ({
    ...c,
    spells: c.spells.map((s, n) => (n === index ? { ...s, grantedBy: grantedBy || undefined } : s))
  }));
}

export function removeSpell(index: number) {
  update((c) => ({ ...c, spells: c.spells.filter((_, n) => n !== index) }));
}

// --- Hit points ---

export function setHp(field: 'current' | 'max' | 'temp', value: number) {
  update((c) => ({ ...c, hp: { ...c.hp, [field]: Math.max(0, value) } }));
}

// --- Resources (limited-use features) ---

export function addResource(resource: Omit<Resource, 'id'>) {
  update((c) => ({
    ...c,
    resources: [...c.resources, { ...resource, id: crypto.randomUUID() }]
  }));
}

export function removeResource(id: string) {
  update((c) => ({ ...c, resources: c.resources.filter((r) => r.id !== id) }));
}

/** Spend (+1) or restore (-1) a use, clamped to [0, max]. */
export function adjustResource(id: string, delta: number) {
  update((c) => ({
    ...c,
    resources: c.resources.map((r) =>
      r.id === id ? { ...r, used: Math.min(r.max, Math.max(0, r.used + delta)) } : r
    )
  }));
}

export function setResourceMax(id: string, max: number) {
  update((c) => ({
    ...c,
    resources: c.resources.map((r) =>
      r.id === id ? { ...r, max: Math.max(0, max), used: Math.min(r.used, Math.max(0, max)) } : r
    )
  }));
}

// --- Spell slots ---

export function setSlotMax(level: number, max: number) {
  update((c) => ({
    ...c,
    spellSlots: c.spellSlots.map((s, i) =>
      i === level - 1
        ? { max: Math.max(0, max), expended: Math.min(s.expended, Math.max(0, max)) }
        : s
    )
  }));
}

/** Set expended slots at a level directly (clamped ≥ 0; component caps to max). */
export function setSlotExpended(level: number, used: number) {
  update((c) => ({
    ...c,
    spellSlots: c.spellSlots.map((s, i) => (i === level - 1 ? { ...s, expended: Math.max(0, used) } : s))
  }));
}

/** Set expended Warlock Pact Magic slots. */
export function setPactExpended(used: number) {
  update((c) => ({ ...c, pactSlotsExpended: Math.max(0, used) }));
}

/** Toggle auto-computed slot maxes vs manual entry. */
export function setSpellSlotsAuto(auto: boolean) {
  update((c) => ({ ...c, spellSlotsAuto: auto }));
}

/** Expend (+1) or recover (-1) a slot at a level, clamped to [0, max]. */
export function adjustSlot(level: number, delta: number) {
  update((c) => ({
    ...c,
    spellSlots: c.spellSlots.map((s, i) =>
      i === level - 1
        ? { ...s, expended: Math.min(s.max, Math.max(0, s.expended + delta)) }
        : s
    )
  }));
}

// --- Buffs & effects ---

export function addBuff(buff: Omit<Buff, 'id'>) {
  update((c) => ({ ...c, buffs: [...c.buffs, { ...buff, id: crypto.randomUUID() }] }));
}

export function removeBuff(id: string) {
  update((c) => ({ ...c, buffs: c.buffs.filter((b) => b.id !== id) }));
}

/**
 * Toggle a buff. Activating a concentration buff drops any other concentration
 * buff, since you can only concentrate on one effect at a time.
 */
export function toggleBuff(id: string) {
  update((c) => {
    const target = c.buffs.find((b) => b.id === id);
    if (!target) return c;
    const activating = !target.active;
    const buffs = c.buffs.map((b) => {
      if (b.id === id) return { ...b, active: activating };
      // Turning on a concentration buff ends other concentration effects.
      if (activating && target.concentration && b.concentration && b.active) {
        return { ...b, active: false };
      }
      return b;
    });
    return { ...c, buffs };
  });
}

// --- Conditions & exhaustion ---

export function toggleCondition(name: string) {
  update((c) => {
    const has = c.conditions.includes(name);
    const conditions = has
      ? c.conditions.filter((n) => n !== name)
      : [...c.conditions, name];
    return { ...c, conditions };
  });
}

export function setExhaustion(level: number) {
  update((c) => ({ ...c, exhaustion: Math.min(6, Math.max(0, level)) }));
}

// --- Rest & level up ---

export function rest(type: RestType) {
  update((c) => applyRest(c, type));
}

export function levelUp(plan: LevelUpPlan) {
  update((c) => applyLevelUp(c, plan));
}

export function spendHitDie(die: number, heal: number) {
  update((c) => spendHitDiePure(c, die, heal));
}

/** Manually adjust a hit-die pool's spent count (for ad-hoc tracking). */
export function adjustHitDie(die: number, delta: number) {
  update((c) => ({
    ...c,
    hitDice: c.hitDice.map((p) =>
      p.die === die ? { ...p, used: Math.min(p.max, Math.max(0, p.used + delta)) } : p
    )
  }));
}

export function resetCharacter() {
  store.set(createCharacter());
}

// --- Manual buffs/debuffs (buff mode) ---

/** Source label marking a modifier created by buff-mode editing. */
export const MANUAL_SOURCE = 'Manual buff';

/**
 * Apply a delta to a node's manual adjustment (one merged modifier per node).
 * This is how buff mode turns an edit into a temporary buff/debuff on the calc
 * graph instead of changing a base value.
 */
export function adjustNode(nodeId: string, delta: number) {
  update((c) => ({ ...c, modifiers: applyAdjustment(c.modifiers, nodeId, MANUAL_SOURCE, delta) }));
}

/** Net manual adjustment currently on a node (0 if none). */
export function manualAdjustment(c: Character, nodeId: string): number {
  return adjustmentValue(c.modifiers, nodeId, MANUAL_SOURCE);
}

export function clearManualModifier(nodeId: string) {
  update((c) => ({
    ...c,
    modifiers: c.modifiers.filter((m) => !(m.target === nodeId && m.source === MANUAL_SOURCE))
  }));
}

export function clearAllManualModifiers() {
  update((c) => ({ ...c, modifiers: c.modifiers.filter((m) => m.source !== MANUAL_SOURCE) }));
}

/** Snapshot the current character (for export). */
export function snapshot(): Character {
  return get(store);
}

// --- Notes ---

function noteId(): string {
  return crypto.randomUUID();
}

/** Walk a tree, calling `fn` on each node. Returns true to stop. */
function walkNodes(nodes: NoteNode[], fn: (n: NoteNode, siblings: NoteNode[], idx: number) => boolean): boolean {
  for (let i = 0; i < nodes.length; i++) {
    if (fn(nodes[i], nodes, i)) return true;
    if (isNoteFolder(nodes[i]) && walkNodes((nodes[i] as NoteFolder).children, fn)) return true;
  }
  return false;
}

/** Replace the entire notes tree. */
export function setNotes(notes: NoteNode[]) {
  update((c) => ({ ...c, notes }));
}

/** Create a new document (at root or inside a folder). */
export function addNoteDoc(parentId: string | null, name: string): string {
  const id = noteId();
  update((c) => {
    const tree = [...(c.notes ?? [])];
    const doc: NoteDoc = { id, name, content: '' };
    if (!parentId) {
      tree.push(doc);
    } else {
      walkNodes(tree, (n) => {
        if (isNoteFolder(n) && n.id === parentId) {
          n.children = [...n.children, doc];
          return true;
        }
        return false;
      });
    }
    return { ...c, notes: tree };
  });
  return id;
}

/** Create a new folder (at root or inside a folder). */
export function addNoteFolder(parentId: string | null, name: string): string {
  const id = noteId();
  update((c) => {
    const tree = [...(c.notes ?? [])];
    const folder: NoteFolder = { id, name, children: [] };
    if (!parentId) {
      tree.push(folder);
    } else {
      walkNodes(tree, (n) => {
        if (isNoteFolder(n) && n.id === parentId) {
          n.children = [...n.children, folder];
          return true;
        }
        return false;
      });
    }
    return { ...c, notes: tree };
  });
  return id;
}

/** Rename a note or folder by id. */
export function renameNote(id: string, name: string) {
  update((c) => {
    const tree = [...(c.notes ?? [])];
    walkNodes(tree, (n) => {
      if (n.id === id) { n.name = name; return true; }
      return false;
    });
    return { ...c, notes: tree };
  });
}

/** Save the markdown content of a doc by id. */
export function saveNoteContent(id: string, content: string) {
  update((c) => {
    const tree = [...(c.notes ?? [])];
    walkNodes(tree, (n) => {
      if (!isNoteFolder(n) && n.id === id) { (n as NoteDoc).content = content; return true; }
      return false;
    });
    return { ...c, notes: tree };
  });
}

/** Delete a note or folder by id (removes from wherever it lives in the tree). */
export function deleteNote(id: string) {
  update((c) => {
    const tree = [...(c.notes ?? [])];
    walkNodes(tree, (_, siblings, idx) => {
      if (siblings[idx].id === id) { siblings.splice(idx, 1); return true; }
      return false;
    });
    return { ...c, notes: tree };
  });
}
