import type { NamedEntry } from '../data/catalog.js';
import { itemTypeLabel } from '../data/facets.js';
import { renderEntriesHtml } from './entries.js';

/** A spell or item rendered for the detail window. */
export interface DetailContent {
  title: string;
  /** One-line classification (e.g. "3rd-level Evocation"). */
  subtitle: string;
  /** Labelled meta lines (Casting Time, Range, …). */
  meta: { label: string; value: string }[];
  html: string;
  source: string;
}

const SCHOOLS: Record<string, string> = {
  A: 'Abjuration', C: 'Conjuration', D: 'Divination', E: 'Enchantment',
  V: 'Evocation', I: 'Illusion', N: 'Necromancy', T: 'Transmutation'
};
const ordinal = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 >> 3 ^ 1) && n % 10 < 4 ? n % 10 : 0] ?? 'th'}`;

function spellLevelSchool(s: NamedEntry): string {
  const school = SCHOOLS[String(s.school)] ?? '';
  const lvl = typeof s.level === 'number' ? s.level : 0;
  return lvl === 0 ? `${school} cantrip` : `${ordinal(lvl)}-level ${school}`.trim();
}

function castingTime(s: NamedEntry): string {
  const t = Array.isArray(s.time) ? (s.time[0] as { number?: number; unit?: string; condition?: string }) : undefined;
  if (!t) return '';
  return `${t.number ?? 1} ${t.unit ?? ''}${t.condition ? `, ${t.condition}` : ''}`.trim();
}

function rangeText(s: NamedEntry): string {
  const r = s.range as { type?: string; distance?: { type?: string; amount?: number } } | undefined;
  if (!r) return '';
  const d = r.distance;
  if (d?.type === 'feet' || d?.type === 'miles') return `${d.amount} ${d.type}`;
  if (d?.type) return d.type.charAt(0).toUpperCase() + d.type.slice(1); // self / touch / sight / unlimited
  return r.type ?? '';
}

function components(s: NamedEntry): string {
  const c = s.components as { v?: boolean; s?: boolean; m?: unknown } | undefined;
  if (!c) return '';
  const parts: string[] = [];
  if (c.v) parts.push('V');
  if (c.s) parts.push('S');
  if (c.m) parts.push(typeof c.m === 'string' ? `M (${c.m})` : 'M');
  return parts.join(', ');
}

function durationText(s: NamedEntry): string {
  const d = Array.isArray(s.duration) ? (s.duration[0] as { type?: string; duration?: { amount?: number; type?: string }; concentration?: boolean }) : undefined;
  if (!d) return '';
  if (d.type === 'instant') return 'Instantaneous';
  if (d.type === 'permanent') return 'Until dispelled';
  if (d.type === 'timed' && d.duration) {
    const body = `${d.duration.amount} ${d.duration.type}${(d.duration.amount ?? 0) === 1 ? '' : 's'}`;
    return d.concentration ? `Concentration, up to ${body}` : body;
  }
  return d.type ?? '';
}

function spellDetail(s: NamedEntry): DetailContent {
  const meta = [
    { label: 'Casting Time', value: castingTime(s) },
    { label: 'Range', value: rangeText(s) },
    { label: 'Components', value: components(s) },
    { label: 'Duration', value: durationText(s) }
  ].filter((m) => m.value);
  const classes = (s._classes as string[] | undefined)?.length ? (s._classes as string[]).join(', ') : '';
  if (classes) meta.push({ label: 'Classes', value: classes });
  let html = renderEntriesHtml(s.entries);
  if (Array.isArray(s.entriesHigherLevel)) html += renderEntriesHtml(s.entriesHigherLevel);
  return { title: s.name, subtitle: spellLevelSchool(s), meta, html, source: String(s.source) };
}

function itemDetail(it: NamedEntry): DetailContent {
  const meta: { label: string; value: string }[] = [];
  if (it.rarity && it.rarity !== 'none') meta.push({ label: 'Rarity', value: String(it.rarity) });
  if (it.reqAttune) meta.push({ label: 'Attunement', value: typeof it.reqAttune === 'string' ? `Requires ${it.reqAttune}` : 'Required' });
  if (typeof it.weight === 'number') meta.push({ label: 'Weight', value: `${it.weight} lb.` });
  if (it.value) meta.push({ label: 'Value', value: `${Number(it.value) / 100} gp` });
  return { title: it.name, subtitle: itemTypeLabel(it), meta, html: renderEntriesHtml(it.entries), source: String(it.source) };
}

export function detailContent(kind: 'spell' | 'item', entry: NamedEntry): DetailContent {
  return kind === 'spell' ? spellDetail(entry) : itemDetail(entry);
}

/** A standalone HTML document for the pop-out window. */
export function detailDocument(c: DetailContent): string {
  const metaRows = c.meta.map((m) => `<p class="m"><b>${m.label}:</b> ${m.value}</p>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${c.title}</title><style>
    body{font:15px/1.5 system-ui,sans-serif;max-width:640px;margin:1.5rem auto;padding:0 1rem;color:#1a1a1a;background:#fff;}
    h1{font-size:1.4rem;margin:0;} .sub{color:#666;font-style:italic;margin:.1rem 0 .8rem;}
    .m{margin:.15rem 0;} .src{color:#999;font-size:.8rem;margin-top:1rem;}
    table{border-collapse:collapse;margin:.5rem 0;} th,td{border:1px solid #ccc;padding:.2rem .5rem;text-align:left;}
    a{color:#7a3;} .detail-h{margin:.6rem 0 .1rem;}
  </style></head><body><h1>${c.title}</h1><p class="sub">${c.subtitle}</p>${metaRows}<hr>${c.html}<p class="src">Source: ${c.source}</p></body></html>`;
}
