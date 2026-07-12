import type { NamedEntry } from './catalog.js';

/**
 * Resolve 5etools bestiary `_copy` inheritance and `_versions` expansion so
 * creatures defined by copying/extending another render with full stats.
 *
 * This is a focused port of the generic copy applier in the 5etools source
 * (`DataUtil.generic.copyApplier` in js/utils.js): a creature's `_copy` points to
 * a base by name+source; the base's fields fill in anything the copy omits
 * (respecting `_preserve`), then `_mod` operations mutate arrays/props. `_versions`
 * are additional entities derived from a parent (e.g. "Celestial Spirit (Avenger)").
 *
 * Only the modes that actually occur in bestiary data are implemented; anything
 * unrecognised is skipped (wrapped in try/catch) so one odd creature can't break
 * the whole catalog.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Obj = Record<string, any>;

const key = (name: string, source: string) => `${name}`.toLowerCase() + '|' + `${source}`.toLowerCase();
const clone = <T>(v: T): T => structuredClone(v);

/** Fields only inherited from a base when the copy opts in via `_preserve`. */
const PRESERVE = new Set([
  // generic
  'page', 'otherSources', 'referenceSources', 'srd', 'srd52', 'basicRules',
  'basicRules2024', 'reprintedAs', 'hasFluff', 'hasFluffImages', 'hasToken',
  // monster
  'legendaryGroup', 'environment', 'soundClip', 'altArt', 'variant',
  'dragonCastingColor', 'familiar'
]);

/** Props `_mod: {"*": …}` fans out across (mirrors COPY_ENTRY_PROPS). */
const COPY_ENTRY_PROPS = [
  'action', 'bonus', 'reaction', 'trait', 'legendary', 'mythic', 'variant', 'spellcasting',
  'actionHeader', 'bonusHeader', 'reactionHeader', 'legendaryHeader', 'mythicHeader'
];

// ── path helpers (MiscUtil.get/set) ─────────────────────────────────────────
function getPath(obj: Obj, path: string[]): any {
  let o: any = obj;
  for (const k of path) {
    if (o == null) return undefined;
    o = o[k];
  }
  return o;
}
function setPath(obj: Obj, path: string[], val: any): void {
  let o: any = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    if (o[k] == null) o[k] = {};
    o = o[k];
  }
  o[path[path.length - 1]] = val;
}

// ── 5e helpers (Parser.crToPb / ability mod / skill→ability) ────────────────
function crToNumber(cr: unknown): number {
  const raw = typeof cr === 'object' && cr ? (cr as Obj).cr : cr;
  if (raw == null) return 0;
  const s = String(raw).trim();
  if (s.includes('/')) {
    const [a, b] = s.split('/').map(Number);
    return b ? a / b : 0;
  }
  return Number(s) || 0;
}
function crToPb(cr: unknown): number {
  const n = crToNumber(cr);
  return n < 5 ? 2 : Math.ceil(n / 4) + 1;
}
const abilityModNum = (score: unknown) => Math.floor(((Number(score) || 10) - 10) / 2);
const SKILL_ABILITY: Record<string, string> = {
  athletics: 'str',
  acrobatics: 'dex', 'sleight of hand': 'dex', stealth: 'dex',
  arcana: 'int', history: 'int', investigation: 'int', nature: 'int', religion: 'int',
  'animal handling': 'wis', insight: 'wis', medicine: 'wis', perception: 'wis', survival: 'wis',
  deception: 'cha', intimidation: 'cha', performance: 'cha', persuasion: 'cha'
};

// ── tag-aware text replace (approximates Renderer.splitByTags) ───────────────
function replaceOutsideTags(str: string, re: RegExp, withStr: string, tagInsensitive: boolean): string {
  if (tagInsensitive) return str.replace(re, withStr);
  let out = '';
  let i = 0;
  while (i < str.length) {
    if (str[i] === '{' && str[i + 1] === '@') {
      let depth = 0;
      let j = i;
      for (; j < str.length; j++) {
        if (str[j] === '{') depth++;
        else if (str[j] === '}' && --depth === 0) { j++; break; }
      }
      out += str.slice(i, j); // copy the tag verbatim
      i = j;
    } else {
      let j = i;
      while (j < str.length && !(str[j] === '{' && str[j + 1] === '@')) j++;
      out += str.slice(i, j).replace(re, withStr);
      i = j;
    }
  }
  return out;
}

function walkReplace(value: any, re: RegExp, withStr: string, tagInsensitive: boolean): any {
  if (typeof value === 'string') return replaceOutsideTags(value, re, withStr, tagInsensitive);
  if (Array.isArray(value)) return value.map((v) => walkReplace(v, re, withStr, tagInsensitive));
  if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) value[k] = walkReplace(value[k], re, withStr, tagInsensitive);
    return value;
  }
  return value;
}

// ── mod handlers ─────────────────────────────────────────────────────────────
const ensureArray = (o: Obj, prop: string) => {
  if (!Array.isArray(o[prop])) o[prop] = [o[prop]];
};

function applyMod(copyTo: Obj, prop: string | null, modInfo: any): void {
  const propPath = prop ? prop.split('.') : null;

  if (typeof modInfo === 'string') {
    if (modInfo === 'remove' && prop) delete copyTo[prop];
    return;
  }

  switch (modInfo.mode) {
    case 'appendStr': {
      if (!propPath) return;
      const cur = getPath(copyTo, propPath);
      setPath(copyTo, propPath, cur ? `${cur}${modInfo.joiner || ''}${modInfo.str}` : modInfo.str);
      return;
    }
    case 'replaceTxt':
    case 'replaceName': {
      if (!propPath) return;
      const ents = getPath(copyTo, propPath);
      if (!Array.isArray(ents)) return;
      const re = new RegExp(modInfo.replace, `g${modInfo.flags || ''}`);
      const props = modInfo.mode === 'replaceName' ? ['name'] : (modInfo.props || [null, 'entries', 'headerEntries', 'footerEntries']);
      ents.forEach((ent, i) => {
        if (props.includes(null) && typeof ent === 'string') {
          ents[i] = replaceOutsideTags(ent, re, modInfo.with, !!modInfo.tagInsensitive);
        }
        if (ent && typeof ent === 'object') {
          for (const p of props) {
            if (p == null) continue;
            if (ent[p] != null) ent[p] = walkReplace(ent[p], re, modInfo.with, !!modInfo.tagInsensitive);
          }
        }
      });
      return;
    }
    case 'prependArr': {
      ensureArray(modInfo, 'items');
      const cur = getPath(copyTo, propPath!);
      setPath(copyTo, propPath!, cur ? modInfo.items.concat(cur) : modInfo.items);
      return;
    }
    case 'appendArr': {
      ensureArray(modInfo, 'items');
      const cur = getPath(copyTo, propPath!);
      setPath(copyTo, propPath!, cur ? cur.concat(modInfo.items) : modInfo.items);
      return;
    }
    case 'appendIfNotExistsArr': {
      ensureArray(modInfo, 'items');
      const cur = getPath(copyTo, propPath!);
      if (!cur) return setPath(copyTo, propPath!, modInfo.items);
      const has = (it: any) => cur.some((x: any) => JSON.stringify(x) === JSON.stringify(it));
      setPath(copyTo, propPath!, cur.concat(modInfo.items.filter((it: any) => !has(it))));
      return;
    }
    case 'replaceArr':
      replaceArr(copyTo, propPath!, modInfo);
      return;
    case 'replaceOrAppendArr': {
      if (!replaceArr(copyTo, propPath!, modInfo)) {
        ensureArray(modInfo, 'items');
        const cur = getPath(copyTo, propPath!);
        setPath(copyTo, propPath!, cur ? cur.concat(modInfo.items) : modInfo.items);
      }
      return;
    }
    case 'insertArr': {
      ensureArray(modInfo, 'items');
      const cur = getPath(copyTo, propPath!);
      if (!Array.isArray(cur)) return;
      cur.splice(~modInfo.index ? modInfo.index : cur.length, 0, ...modInfo.items);
      return;
    }
    case 'removeArr': {
      const cur = getPath(copyTo, propPath!);
      if (!Array.isArray(cur)) return;
      if (modInfo.names) {
        ensureArray(modInfo, 'names');
        for (const name of modInfo.names) {
          const ix = cur.findIndex((it: any) => it?.name === name);
          if (~ix) cur.splice(ix, 1);
        }
      } else if (modInfo.items) {
        ensureArray(modInfo, 'items');
        for (const item of modInfo.items) {
          const ix = cur.findIndex((it: any) => it === item);
          if (~ix) cur.splice(ix, 1);
        }
      }
      return;
    }
    case 'renameArr': {
      ensureArray(modInfo, 'renames');
      const cur = getPath(copyTo, propPath!);
      if (!Array.isArray(cur)) return;
      for (const r of modInfo.renames) {
        const ent = cur.find((e: any) => e?.name === r.rename);
        if (ent) ent.name = r.with;
      }
      return;
    }
    case 'calculateProp': {
      const tgt = getPath(copyTo, propPath!) ?? {};
      setPath(copyTo, propPath!, tgt);
      const expr = String(modInfo.formula).replace(/<\$([^$]+)\$>/g, (_m, v) => {
        if (v === 'prof_bonus') return String(crToPb(copyTo.cr));
        if (v === 'dex_mod') return String(abilityModNum(copyTo.dex));
        return '0';
      });
      // Only simple arithmetic reaches here; guard against anything else.
      if (/^[\d\s+\-*/().]+$/.test(expr)) tgt[modInfo.prop] = Math.floor(evalArith(expr));
      return;
    }
    case 'scalarAddProp':
    case 'scalarMultProp': {
      const tgt = getPath(copyTo, propPath!);
      if (!tgt) return;
      const apply = (k: string) => {
        const base = Number(tgt[k]);
        let out = modInfo.mode === 'scalarAddProp' ? base + modInfo.scalar : base * modInfo.scalar;
        if (modInfo.floor) out = Math.floor(out);
        tgt[k] = typeof tgt[k] === 'string' ? `${out >= 0 ? '+' : ''}${out}` : out;
      };
      if (modInfo.prop === '*') Object.keys(tgt).forEach(apply);
      else apply(modInfo.prop);
      return;
    }
    case 'setProp': {
      const combined = modInfo.prop ? modInfo.prop.split('.') : [];
      if (propPath && !(propPath.length === 1 && propPath[0] === '*')) combined.unshift(...propPath);
      setPath(copyTo, combined, clone(modInfo.value));
      return;
    }
    case 'prefixSuffixStringProp': {
      const combined = modInfo.prop ? modInfo.prop.split('.') : [];
      if (propPath && !(propPath.length === 1 && propPath[0] === '*')) combined.unshift(...propPath);
      const str = getPath(copyTo, combined);
      if (typeof str === 'string') setPath(copyTo, combined, `${modInfo.prefix || ''}${str}${modInfo.suffix || ''}`);
      return;
    }
    case 'addSenses': {
      ensureArray(modInfo, 'senses');
      copyTo.senses = copyTo.senses || [];
      for (const sense of modInfo.senses) {
        let found = false;
        for (let i = 0; i < copyTo.senses.length; i++) {
          const m = new RegExp(`${sense.type} (\\d+)`, 'i').exec(copyTo.senses[i]);
          if (m) {
            found = true;
            if (Number(m[1]) < sense.range) copyTo.senses[i] = `${sense.type} ${sense.range} ft.`;
            break;
          }
        }
        if (!found) copyTo.senses.push(`${sense.type} ${sense.range} ft.`);
      }
      return;
    }
    case 'addSaves':
    case 'addAllSaves': {
      copyTo.save = copyTo.save || {};
      const saves = modInfo.mode === 'addAllSaves'
        ? Object.fromEntries(['str', 'dex', 'con', 'int', 'wis', 'cha'].map((a) => [a, modInfo.saves]))
        : modInfo.saves;
      for (const [save, mode] of Object.entries(saves) as [string, number][]) {
        const total = mode * crToPb(copyTo.cr) + abilityModNum(copyTo[save]);
        const asText = total >= 0 ? `+${total}` : String(total);
        if (copyTo.save[save] == null || Number(copyTo.save[save]) < total) copyTo.save[save] = asText;
      }
      return;
    }
    case 'addSkills':
    case 'addAllSkills': {
      copyTo.skill = copyTo.skill || {};
      const skills = modInfo.mode === 'addAllSkills'
        ? Object.fromEntries(Object.keys(SKILL_ABILITY).map((s) => [s, modInfo.skills]))
        : modInfo.skills;
      for (const [skill, mode] of Object.entries(skills) as [string, number][]) {
        const abil = SKILL_ABILITY[skill.toLowerCase()] ?? 'int';
        const total = mode * crToPb(copyTo.cr) + abilityModNum(copyTo[abil]);
        const asText = total >= 0 ? `+${total}` : String(total);
        if (copyTo.skill[skill] == null || Number(copyTo.skill[skill]) < total) copyTo.skill[skill] = asText;
      }
      return;
    }
    default:
      // Unhandled/rare mode (spell mods, maxSize, xp scaling): leave as-is.
      return;
  }
}

function replaceArr(copyTo: Obj, propPath: string[], modInfo: any): boolean {
  ensureArray(modInfo, 'items');
  const cur = getPath(copyTo, propPath);
  if (!Array.isArray(cur)) return false;
  let ix: number;
  if (modInfo.replace?.regex) {
    const re = new RegExp(modInfo.replace.regex, modInfo.replace.flags || '');
    ix = cur.findIndex((it: any) => (it?.name ? re.test(it.name) : typeof it === 'string' ? re.test(it) : false));
  } else if (modInfo.replace?.index != null) {
    ix = modInfo.replace.index;
  } else {
    ix = cur.findIndex((it: any) => (it?.name ? it.name === modInfo.replace : it === modInfo.replace));
  }
  if (~ix) {
    cur.splice(ix, 1, ...modInfo.items);
    return true;
  }
  return false;
}

/** Minimal, safe arithmetic evaluator for calculateProp formulas. */
function evalArith(expr: string): number {
  // eslint-disable-next-line no-new-func
  return Function(`"use strict";return (${expr});`)() as number;
}

const PROPS_TAIL = ['_', '*'];
function applyCopy(copyFrom: Obj, copyTo: Obj): void {
  const meta = copyTo._copy || {};
  const mod: Record<string, any> = meta._mod ? { ...meta._mod } : {};
  // Normalise: every mod value becomes an array.
  for (const k of Object.keys(mod)) if (!Array.isArray(mod[k])) mod[k] = [mod[k]];

  // Fill in anything the copy omits, honouring `_preserve`.
  for (const k of Object.keys(copyFrom)) {
    if (copyTo[k] === null) { delete copyTo[k]; continue; }
    if (copyTo[k] == null) {
      if (PRESERVE.has(k)) {
        if (meta._preserve?.['*'] || meta._preserve?.[k]) copyTo[k] = clone(copyFrom[k]);
      } else {
        copyTo[k] = clone(copyFrom[k]);
      }
    }
  }

  // Apply mods, with '_' and '*' last.
  const entries = Object.entries(mod).sort(
    ([a], [b]) => PROPS_TAIL.indexOf(a) - PROPS_TAIL.indexOf(b)
  );
  for (const [prop, modInfos] of entries) {
    const props = prop === '*' ? COPY_ENTRY_PROPS : prop === '_' ? [null] : [prop];
    for (const p of props) {
      for (const modInfo of modInfos as any[]) {
        try {
          applyMod(copyTo, p, modInfo);
        } catch {
          /* skip a failed individual mod rather than dropping the creature */
        }
      }
    }
  }

  copyTo._isCopy = true;
  delete copyTo._copy;
}

// ── versions ─────────────────────────────────────────────────────────────────
function mutExpandCopy(ent: Obj): void {
  ent._copy = { _mod: ent._mod, _templates: ent._templates, _preserve: ent._preserve || { '*': true } };
  delete ent._mod;
  delete ent._preserve;
}

function expandVersions(parent: Obj): Obj[] {
  const list: Obj[] = Array.isArray(parent._versions) ? parent._versions : [];
  const out: Obj[] = [];
  for (const raw of list) {
    let expansions: Obj[];
    if (raw._abstract && Array.isArray(raw._implementations)) {
      expansions = raw._implementations.map((impl: Obj) => {
        let tpl = clone(raw._abstract);
        const cpyImpl = clone(impl);
        mutExpandCopy(tpl);
        if (cpyImpl._variables) {
          tpl = walkReplace(tpl, /\{\{([^}]+)\}\}/g, '', false); // placeholder pass below
          tpl = JSON.parse(
            JSON.stringify(tpl).replace(/\{\{([^}]+)\}\}/g, (_m, v) => String(cpyImpl._variables[v] ?? ''))
          );
          delete cpyImpl._variables;
        }
        return Object.assign(tpl, cpyImpl);
      });
    } else {
      const v = clone(raw);
      mutExpandCopy(v);
      expansions = [v];
    }
    for (const v of expansions) {
      const cpyParent = clone(parent);
      delete cpyParent._versions;
      delete cpyParent.hasToken;
      applyCopy(cpyParent, v);
      out.push(v);
    }
  }
  return out;
}

/** Resolve `_copy` and expand `_versions` across a raw monster list. */
export function resolveMonsters(raw: NamedEntry[]): NamedEntry[] {
  const byKey = new Map<string, NamedEntry>();
  for (const m of raw) byKey.set(key(m.name, String(m.source)), m);

  const cache = new Map<string, Obj>();
  const inFlight = new Set<string>();

  function resolveCopy(entry: NamedEntry): Obj {
    const k = key(entry.name, String(entry.source));
    const cached = cache.get(k);
    if (cached) return cached;
    const copyMeta = (entry as Obj)._copy;
    if (!copyMeta) {
      const c = clone(entry) as Obj;
      cache.set(k, c);
      return c;
    }
    const copyTo = clone(entry) as Obj;
    if (inFlight.has(k)) { delete copyTo._copy; return copyTo; } // cycle guard
    inFlight.add(k);
    const baseRaw = byKey.get(key(copyMeta.name, String(copyMeta.source)));
    if (!baseRaw) delete copyTo._copy; // base not loaded — render own fields only
    else applyCopy(resolveCopy(baseRaw), copyTo);
    inFlight.delete(k);
    cache.set(k, copyTo);
    return copyTo;
  }

  const out: NamedEntry[] = [];
  for (const entry of raw) {
    const resolved = resolveCopy(entry);
    if (Array.isArray(resolved._versions) && resolved._versions.length) {
      const versions = expandVersions(resolved);
      const parent = clone(resolved);
      delete parent._versions;
      out.push(parent as NamedEntry);
      out.push(...(versions as NamedEntry[]));
    } else {
      out.push(resolved as NamedEntry);
    }
  }
  return out;
}
