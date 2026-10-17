/**
 * A character's *status* — what changes at the table rather than at level-up:
 * hit points, conditions, exhaustion, spent resource uses and spell slots. This
 * is the slice a linked GM tool reads and (with a read-write link) writes.
 *
 * The server has neither the catalog nor the calc engine, so maxima it cannot
 * read off the document (auto-computed spell slots, class resource pools) come
 * from the `summary` the sheet client computes and saves alongside the doc. A
 * value is clamped to whatever maximum is known; with no summary yet, only the
 * document's own maxima apply.
 */

/**
 * The 5e conditions the sheet shows as chips. Mirrors `CONDITIONS` in
 * src/lib/character/effects.ts — the server cannot import TypeScript, and a
 * condition the sheet has no chip for would be invisible to the player.
 */
export const CONDITIONS = [
  'Blinded',
  'Charmed',
  'Deafened',
  'Frightened',
  'Grappled',
  'Incapacitated',
  'Invisible',
  'Paralyzed',
  'Petrified',
  'Poisoned',
  'Prone',
  'Restrained',
  'Stunned',
  'Unconscious'
];
const CONDITION_BY_LC = new Map(CONDITIONS.map((c) => [c.toLowerCase(), c]));

export const MAX_EXHAUSTION = 6;
const HP_LIMIT = 99999;
const PATCH_KEYS = new Set(['hp', 'conditions', 'exhaustion', 'resources', 'spellSlots', 'pact', 'baseRev']);

const isInt = (v) => Number.isInteger(v);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

function slotMaxima(doc, summary) {
  const fromSummary = Array.isArray(summary?.spellSlots) ? summary.spellSlots : null;
  const docSlots = Array.isArray(doc.spellSlots) ? doc.spellSlots : [];
  return Array.from({ length: 9 }, (_, i) => {
    if (fromSummary) {
      const s = fromSummary.find((x) => x?.level === i + 1);
      return num(s?.max);
    }
    return num(docSlots[i]?.max);
  });
}

/** The status view of a document: the shape a GM tool reads. */
export function statusOf(doc, summary) {
  const hp = doc.hp ?? {};
  const resources = [];
  for (const r of Array.isArray(doc.resources) ? doc.resources : []) {
    resources.push({ key: r.id, name: r.name, max: num(r.max), used: num(r.used), recharge: r.recharge, kind: 'custom' });
  }
  const used = doc.featureResourceUsed ?? {};
  for (const r of Array.isArray(summary?.resources) ? summary.resources : []) {
    if (r?.kind !== 'feature') continue;
    resources.push({ key: r.key, name: r.name, max: num(r.max), used: Math.min(num(used[r.key]), num(r.max)), recharge: r.recharge, kind: 'feature' });
  }
  const maxima = slotMaxima(doc, summary);
  const docSlots = Array.isArray(doc.spellSlots) ? doc.spellSlots : [];
  const spellSlots = [];
  for (let i = 0; i < 9; i++) {
    const expended = num(docSlots[i]?.expended);
    if (maxima[i] > 0 || expended > 0) spellSlots.push({ level: i + 1, max: maxima[i], expended });
  }
  const pactInfo = summary?.pact && typeof summary.pact === 'object' ? summary.pact : null;
  const pact = pactInfo
    ? { level: num(pactInfo.level), max: num(pactInfo.max), expended: num(doc.pactSlotsExpended) }
    : null;
  return {
    hp: { current: num(hp.current), max: num(hp.max), temp: num(hp.temp) },
    conditions: Array.isArray(doc.conditions) ? [...doc.conditions] : [],
    exhaustion: num(doc.exhaustion),
    resources,
    spellSlots,
    pact
  };
}

const fail = (error) => ({ error });

/**
 * Validate a status patch and apply it to a copy of `doc`. Returns
 * `{ doc, changed }` (the names of the status fields whose value moved) or
 * `{ error }`. Absolute values, not deltas; out-of-range numbers are clamped to
 * the known maximum, but wrong *types* and unknown keys are refused, since they
 * mean the caller has the contract wrong.
 */
export function applyStatusPatch(doc, summary, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return fail('Body must be a JSON object.');
  for (const k of Object.keys(patch)) if (!PATCH_KEYS.has(k)) return fail(`Unknown field "${k}".`);

  const next = structuredClone(doc);
  const changed = new Set();

  if (patch.hp !== undefined) {
    const p = patch.hp;
    if (!p || typeof p !== 'object' || Array.isArray(p)) return fail('hp must be an object.');
    for (const k of Object.keys(p)) if (k !== 'current' && k !== 'temp') return fail(`Unknown hp field "${k}".`);
    const hp = { max: 0, current: 0, temp: 0, ...(next.hp ?? {}) };
    if (p.current !== undefined) {
      if (!isInt(p.current) || p.current < 0) return fail('hp.current must be a non-negative integer.');
      const max = num(hp.max, HP_LIMIT) || HP_LIMIT;
      const v = clamp(p.current, 0, max);
      if (v !== hp.current) changed.add('hp');
      hp.current = v;
    }
    if (p.temp !== undefined) {
      if (!isInt(p.temp) || p.temp < 0) return fail('hp.temp must be a non-negative integer.');
      const v = clamp(p.temp, 0, HP_LIMIT);
      if (v !== hp.temp) changed.add('hp');
      hp.temp = v;
    }
    next.hp = hp;
  }

  if (patch.conditions !== undefined) {
    if (!Array.isArray(patch.conditions)) return fail('conditions must be an array of condition names.');
    const out = [];
    for (const c of patch.conditions) {
      const canon = typeof c === 'string' ? CONDITION_BY_LC.get(c.trim().toLowerCase()) : undefined;
      if (!canon) return fail(`Unknown condition ${JSON.stringify(c)}. Known: ${CONDITIONS.join(', ')}.`);
      if (!out.includes(canon)) out.push(canon);
    }
    const before = Array.isArray(next.conditions) ? next.conditions : [];
    if (before.length !== out.length || before.some((c) => !out.includes(c))) changed.add('conditions');
    next.conditions = out;
  }

  if (patch.exhaustion !== undefined) {
    if (!isInt(patch.exhaustion)) return fail(`exhaustion must be an integer 0-${MAX_EXHAUSTION}.`);
    const v = clamp(patch.exhaustion, 0, MAX_EXHAUSTION);
    if (v !== num(next.exhaustion)) changed.add('exhaustion');
    next.exhaustion = v;
  }

  if (patch.resources !== undefined) {
    if (!Array.isArray(patch.resources)) return fail('resources must be an array of { key, used }.');
    const features = new Map(
      (Array.isArray(summary?.resources) ? summary.resources : [])
        .filter((r) => r?.kind === 'feature')
        .map((r) => [r.key, r])
    );
    const custom = Array.isArray(next.resources) ? next.resources : [];
    const featureUsed = { ...(next.featureResourceUsed ?? {}) };
    for (const r of patch.resources) {
      if (!r || typeof r.key !== 'string' || !isInt(r.used) || r.used < 0) {
        return fail('Each resource must be { key: string, used: non-negative integer }.');
      }
      const own = custom.find((x) => x.id === r.key);
      if (own) {
        const v = clamp(r.used, 0, num(own.max));
        if (v !== own.used) changed.add('resources');
        own.used = v;
        continue;
      }
      const feat = features.get(r.key);
      if (!feat) return fail(`Unknown resource "${r.key}".`);
      const v = clamp(r.used, 0, num(feat.max));
      if (v !== num(featureUsed[r.key])) changed.add('resources');
      if (v === 0) delete featureUsed[r.key];
      else featureUsed[r.key] = v;
    }
    next.featureResourceUsed = featureUsed;
  }

  if (patch.spellSlots !== undefined) {
    if (!Array.isArray(patch.spellSlots)) return fail('spellSlots must be an array of { level, expended }.');
    const maxima = slotMaxima(doc, summary);
    const slots = Array.from({ length: 9 }, (_, i) => ({ max: 0, expended: 0, ...(next.spellSlots?.[i] ?? {}) }));
    for (const s of patch.spellSlots) {
      if (!s || !isInt(s.level) || s.level < 1 || s.level > 9 || !isInt(s.expended) || s.expended < 0) {
        return fail('Each spell slot must be { level: 1-9, expended: non-negative integer }.');
      }
      const v = clamp(s.expended, 0, maxima[s.level - 1]);
      if (v !== num(slots[s.level - 1].expended)) changed.add('spellSlots');
      slots[s.level - 1].expended = v;
    }
    next.spellSlots = slots;
  }

  if (patch.pact !== undefined) {
    const p = patch.pact;
    if (!p || typeof p !== 'object' || !isInt(p.expended) || p.expended < 0) {
      return fail('pact must be { expended: non-negative integer }.');
    }
    const max = summary?.pact ? num(summary.pact.max) : 0;
    const v = clamp(p.expended, 0, max);
    if (v !== num(next.pactSlotsExpended)) changed.add('pact');
    next.pactSlotsExpended = v;
  }

  return { doc: next, changed: [...changed] };
}

/** Names of the status fields that differ between two status views. */
export function statusDiff(a, b) {
  const out = [];
  for (const k of ['hp', 'conditions', 'exhaustion', 'resources', 'spellSlots', 'pact']) {
    if (JSON.stringify(a?.[k]) !== JSON.stringify(b?.[k])) out.push(k);
  }
  return out;
}
