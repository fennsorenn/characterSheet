import { describe, it, expect } from 'vitest';
import {
  mergeRepoIndex,
  propsByPath,
  supportedProps,
  type RepoSource
} from './repoIndex.js';

// A faithful slice of a real TheGiddyLimit/unearthed-arcana index.
const SOURCES = {
  XUA2025PsionUpdate: 'class/Unearthed Arcana 2025 - Psion Update.json',
  UAArtificer: 'class/Unearthed Arcana - Artificer.json'
};
const META = {
  'Unearthed Arcana 2025 - Psion Update.json': {
    n: ['Unearthed Arcana 2025: Psion Update'],
    a: ['XUA25PU'],
    e: 1
  },
  'Unearthed Arcana - Artificer.json': {
    n: ['Unearthed Arcana: Artificer'],
    a: ['UAA'],
    e: 0
  }
};
// prop -> { path -> prop } (inverted, as 5etools publishes it).
const PROPS = {
  class: {
    'class/Unearthed Arcana 2025 - Psion Update.json': 'class',
    'class/Unearthed Arcana - Artificer.json': 'class'
  },
  subclass: { 'class/Unearthed Arcana - Artificer.json': 'subclass' },
  spell: { 'class/Unearthed Arcana 2025 - Psion Update.json': 'spell' },
  monster: { 'class/Unearthed Arcana 2025 - Psion Update.json': 'monster' }
};

describe('propsByPath', () => {
  it('inverts prop -> {path} into path -> props[] sorted', () => {
    const byPath = propsByPath(PROPS);
    expect(byPath.get('class/Unearthed Arcana 2025 - Psion Update.json')).toEqual([
      'class',
      'monster',
      'spell'
    ]);
    expect(byPath.get('class/Unearthed Arcana - Artificer.json')).toEqual(['class', 'subclass']);
  });
});

describe('mergeRepoIndex', () => {
  it('joins sources + meta (by basename) + props into a source list', () => {
    const list = mergeRepoIndex(SOURCES, META, PROPS);
    // Sorted by display name: "…Arcana 2025:…" (space) sorts before "…Arcana:…" (colon).
    expect(list.map((s) => s.sourceId)).toEqual(['XUA2025PsionUpdate', 'UAArtificer']);
    const psion = list.find((s) => s.sourceId === 'XUA2025PsionUpdate')!;
    expect(psion.name).toBe('Unearthed Arcana 2025: Psion Update');
    expect(psion.abbreviations).toEqual(['XUA25PU']);
    expect(psion.props).toContain('spell');
  });

  it('falls back to the source id when meta is missing', () => {
    const list = mergeRepoIndex({ Loner: 'x/loner.json' }, {}, {});
    expect(list[0].name).toBe('Loner');
    expect(list[0].abbreviations).toEqual([]);
    expect(list[0].props).toEqual([]);
  });
});

describe('supportedProps', () => {
  it('keeps only props this app can ingest, dropping monster/book/etc.', () => {
    const source: RepoSource = {
      sourceId: 'X',
      path: 'x.json',
      name: 'X',
      abbreviations: [],
      props: ['class', 'subclass', 'spell', 'monster', 'book', 'foundryClass']
    };
    expect(supportedProps(source)).toEqual(['class', 'subclass', 'spell']);
  });
});
