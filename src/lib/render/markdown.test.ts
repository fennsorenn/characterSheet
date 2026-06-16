import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './markdown.js';

describe('renderMarkdown', () => {
  it('renders headings, bold/italic, and inline code', () => {
    expect(renderMarkdown('# Title')).toBe('<h1>Title</h1>');
    expect(renderMarkdown('**bold** and *italic* and `code`')).toBe(
      '<p><strong>bold</strong> and <em>italic</em> and <code>code</code></p>'
    );
  });

  it('renders unordered and ordered lists', () => {
    expect(renderMarkdown('- a\n- b')).toBe('<ul><li>a</li><li>b</li></ul>');
    expect(renderMarkdown('1. one\n2. two')).toBe('<ol><li>one</li><li>two</li></ol>');
  });

  it('renders blockquotes, rules, fenced code, and links', () => {
    expect(renderMarkdown('> quoted')).toBe('<blockquote>quoted</blockquote>');
    expect(renderMarkdown('---')).toBe('<hr>');
    expect(renderMarkdown('```\ncode\n```')).toBe('<pre><code>code</code></pre>');
    expect(renderMarkdown('[site](https://example.com)')).toBe(
      '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">site</a></p>'
    );
  });

  it('groups paragraphs by blank lines', () => {
    expect(renderMarkdown('line one\nline two\n\nsecond para')).toBe(
      '<p>line one line two</p>\n<p>second para</p>'
    );
  });

  it('escapes HTML to stay safe', () => {
    expect(renderMarkdown('<script>alert(1)</script>')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
    expect(renderMarkdown('[x](javascript:alert(1))')).toBe('<p>[x](javascript:alert(1))</p>'); // non-http link not linkified
  });
});
