import { parseTaggedString, renderToHtml } from './tags.js';

/**
 * Render a 5etools `entries` tree (strings + nested entry/list/table objects) to
 * HTML, reusing the inline `{@tag …}` renderer for text. Used by the item/spell
 * detail window. Best-effort: unknown node shapes fall back to their entries.
 */
export function renderEntriesHtml(entries: unknown): string {
  return nodes(entries).join('');
}

function nodes(v: unknown): string[] {
  if (v == null) return [];
  if (typeof v === 'string') return [`<p>${renderToHtml(parseTaggedString(v))}</p>`];
  if (Array.isArray(v)) return v.flatMap(nodes);
  if (typeof v === 'object') return [nodeToHtml(v as Record<string, unknown>)];
  return [];
}

function inline(s: string): string {
  return renderToHtml(parseTaggedString(s));
}

function nodeToHtml(o: Record<string, unknown>): string {
  const type = typeof o.type === 'string' ? o.type : 'entries';
  switch (type) {
    case 'list': {
      const items = Array.isArray(o.items) ? o.items : [];
      return `<ul>${items.map((it) => `<li>${typeof it === 'string' ? inline(it) : nodes(it).join('')}</li>`).join('')}</ul>`;
    }
    case 'table': {
      const labels = Array.isArray(o.colLabels) ? o.colLabels : [];
      const rows = Array.isArray(o.rows) ? o.rows : [];
      const head = labels.length ? `<thead><tr>${labels.map((l) => `<th>${inline(String(l))}</th>`).join('')}</tr></thead>` : '';
      const body = rows
        .map((r) => `<tr>${(Array.isArray(r) ? r : [r]).map((c) => `<td>${typeof c === 'string' ? inline(c) : nodes(c).join('')}</td>`).join('')}</tr>`)
        .join('');
      const caption = typeof o.caption === 'string' ? `<caption>${inline(o.caption)}</caption>` : '';
      return `<table class="detail-table">${caption}${head}<tbody>${body}</tbody></table>`;
    }
    case 'item':
    case 'entries':
    default: {
      const name = typeof o.name === 'string' ? o.name : '';
      const heading = name ? `<p class="detail-h"><strong>${inline(name)}.</strong></p>` : '';
      const inner = nodes(o.entries ?? o.items ?? o.entry).join('');
      return heading + inner;
    }
  }
}
