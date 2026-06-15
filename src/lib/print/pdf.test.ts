import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { collectSheetValues, type ValueSource } from './sheetValues.js';
import { buildCharacterPdf } from './pdf.js';
import { buildGraph } from '../character/buildGraph.js';
import { createCharacter } from '../character/schema.js';

function valuesFor(overrides = {}) {
  const character = createCharacter({
    name: 'Aria',
    abilities: { dex: 16, con: 14 } as never,
    hp: { max: 24, current: 18, temp: 0 },
    acBase: 12,
    ...overrides
  });
  const graph = buildGraph(character) as unknown as ValueSource;
  return { character, graph, values: collectSheetValues(character, graph) };
}

describe('collectSheetValues', () => {
  it('flattens character + graph numbers with signs', () => {
    const { values } = valuesFor();
    expect(values.name).toBe('Aria');
    expect(values.classLine).toContain('Level 1');
    expect(values.abilities.find((a) => a.key === 'dex')!.mod).toBe('+3');
    expect(values.combat.ac).toBe('15'); // 12 + dex 3
    expect(values.hp.current).toBe('18');
    expect(values.spell).toBeUndefined();
  });

  it('includes spell stats for casters', () => {
    const { values } = valuesFor({
      abilities: { int: 18 } as never,
      spellcasting: { ability: 'int' }
    });
    expect(values.spell?.dc).toBe('14'); // 8 + prof 2 + int mod 4
  });
});

describe('buildCharacterPdf', () => {
  async function fieldText(bytes: Uint8Array, prefix: string): Promise<string> {
    const doc = await PDFDocument.load(bytes);
    const field = doc
      .getForm()
      .getFields()
      .find((f) => f.getName().startsWith(prefix));
    return field && 'getText' in field ? ((field as never as { getText(): string }).getText() ?? '') : '';
  }

  it('produces a valid AcroForm PDF with prefilled values', async () => {
    const { values } = valuesFor();
    const bytes = await buildCharacterPdf(values, {
      prefill: 'all',
      custom: { frequent: false, occasional: false }
    });
    // Valid PDF header.
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');

    const doc = await PDFDocument.load(bytes);
    expect(doc.getForm().getFields().length).toBeGreaterThan(20);
    expect(await fieldText(bytes, 'hp_cur')).toBe('18');
    expect(await fieldText(bytes, 'ac')).toBe('15');
  });

  it('omits frequent values (HP) but keeps occasional at omit-frequent', async () => {
    const { values } = valuesFor();
    const bytes = await buildCharacterPdf(values, {
      prefill: 'omit-frequent',
      custom: { frequent: false, occasional: false }
    });
    expect(await fieldText(bytes, 'hp_cur')).toBe(''); // frequent → blank
    expect(await fieldText(bytes, 'ac')).toBe('15'); // occasional → kept
  });

  it('blanks every value at level blank', async () => {
    const { values } = valuesFor();
    const bytes = await buildCharacterPdf(values, {
      prefill: 'blank',
      custom: { frequent: false, occasional: false }
    });
    expect(await fieldText(bytes, 'ac')).toBe('');
    expect(await fieldText(bytes, 'hp_cur')).toBe('');
  });
});
