/**
 * Tiny, dependency-free Markdown → HTML renderer for the Notes editor. Input is
 * always HTML-escaped first, then a safe subset of Markdown is applied:
 * headings, bold/italic, inline + fenced code, links, blockquotes, unordered/
 * ordered lists, horizontal rules, and paragraphs. Unknown syntax renders as
 * plain text. Not a spec-complete parser — just enough for character notes.
 */

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Inline formatting on already-escaped text. */
function inline(s: string): string {
  return s
    .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/(^|[^_])_([^_\s][^_]*)_/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, t, h) => `<a href="${h}" target="_blank" rel="noopener noreferrer">${t}</a>`);
}

export function renderMarkdown(md: string): string {
  const lines = (md ?? '').split('\n');
  const out: string[] = [];
  let i = 0;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inline(escapeHtml(para.join(' ')))}</p>`);
      para = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block.
    if (/^```/.test(line)) {
      flushPara();
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(escapeHtml(lines[i++]));
      i++; // closing fence
      out.push(`<pre><code>${body.join('\n')}</code></pre>`);
      continue;
    }
    // Heading.
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushPara();
      const level = h[1].length;
      out.push(`<h${level}>${inline(escapeHtml(h[2]))}</h${level}>`);
      i++;
      continue;
    }
    // Horizontal rule.
    if (/^(---|\*\*\*|___)\s*$/.test(line)) {
      flushPara();
      out.push('<hr>');
      i++;
      continue;
    }
    // Blockquote (consecutive `>` lines).
    if (/^>\s?/.test(line)) {
      flushPara();
      const body: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${inline(escapeHtml(body.join(' ')))}</blockquote>`);
      continue;
    }
    // Lists (group consecutive items).
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      flushPara();
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      const re = ordered ? /^\s*\d+\.\s+(.*)$/ : /^\s*[-*]\s+(.*)$/;
      while (i < lines.length && re.test(lines[i])) items.push(`<li>${inline(escapeHtml(lines[i++].match(re)![1]))}</li>`);
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    // Blank line ends a paragraph.
    if (/^\s*$/.test(line)) {
      flushPara();
      i++;
      continue;
    }
    para.push(line);
    i++;
  }
  flushPara();
  return out.join('\n');
}
