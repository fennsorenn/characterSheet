import { describe, it, expect } from 'vitest';
import { parseTaggedString, renderToText, renderToHtml } from './tags.js';

describe('parseTaggedString', () => {
  it('splits text and tags', () => {
    const nodes = parseTaggedString('take {@damage 1d6} acid damage');
    expect(nodes).toHaveLength(3);
    expect(nodes[0]).toEqual({ type: 'text', value: 'take ' });
    expect(nodes[1]).toMatchObject({ type: 'tag', tag: 'damage' });
    expect(nodes[2]).toEqual({ type: 'text', value: ' acid damage' });
  });

  it('parses pipe-separated parts', () => {
    const [node] = parseTaggedString('{@item longsword|phb|a fine sword}');
    if (node.type !== 'tag') throw new Error('expected tag');
    expect(node.tag).toBe('item');
    expect(node.parts).toHaveLength(3);
    expect(renderToText(node.parts[1])).toBe('phb');
  });

  it('handles nested tags at the right brace depth', () => {
    const [node] = parseTaggedString('{@item x|phb|{@i fancy} sword}');
    if (node.type !== 'tag') throw new Error('expected tag');
    expect(node.parts).toHaveLength(3); // pipe inside {@i ...} is not a split
    expect(renderToText(node.parts[2])).toBe('fancy sword');
  });

  it('leaves an unbalanced brace as literal text', () => {
    const nodes = parseTaggedString('broken {@item oops');
    expect(renderToText(nodes)).toBe('broken {@item oops');
  });
});

describe('renderToText', () => {
  const text = (s: string) => renderToText(parseTaggedString(s));

  it('shows the display override for references, else the name', () => {
    expect(text('{@spell fireball}')).toBe('fireball');
    expect(text('{@spell fireball|phb|a fireball}')).toBe('a fireball');
    expect(text('{@condition prone}')).toBe('prone');
  });

  it('renders rolls and their overrides', () => {
    expect(text('{@damage 1d6}')).toBe('1d6');
    expect(text('{@dice 1d20+5|your check}')).toBe('your check');
  });

  it('handles bespoke tags', () => {
    expect(text('{@hit 5}')).toBe('+5');
    expect(text('{@hit -1}')).toBe('-1');
    expect(text('{@dc 15}')).toBe('DC 15');
    expect(text('{@chance 50}')).toBe('50 percent');
    expect(text('{@recharge 5}')).toBe('(Recharge 5–6)');
    expect(text('{@atk mw}')).toBe('Melee Weapon Attack');
    expect(text('{@h}')).toBe('Hit: ');
  });

  it('strips formatting in plain text', () => {
    expect(text('a {@b bold} and {@i italic} word')).toBe('a bold and italic word');
  });

  it('degrades unknown tags to their first part', () => {
    expect(text('{@madeup something|extra}')).toBe('something');
  });
});

describe('renderToHtml', () => {
  const html = (s: string) => renderToHtml(parseTaggedString(s));

  it('emits interactive reference links with data attributes', () => {
    const out = html('{@item longsword|phb}');
    expect(out).toContain('class="tag-ref"');
    expect(out).toContain('data-tag="item"');
    expect(out).toContain('data-name="longsword"');
    expect(out).toContain('data-source="phb"');
    expect(out).toContain('>longsword<');
  });

  it('emits rollable spans for dice/damage', () => {
    expect(html('{@damage 2d6}')).toContain('data-roll="2d6"');
  });

  it('wraps formatting tags in semantic elements', () => {
    expect(html('{@b hi}')).toBe('<strong>hi</strong>');
    expect(html('{@i hi}')).toBe('<em>hi</em>');
  });

  it('escapes HTML in user-facing text', () => {
    expect(html('a < b & c')).toBe('a &lt; b &amp; c');
  });
});
