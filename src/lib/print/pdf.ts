import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib';
import type { SheetValues } from './sheetValues.js';
import { redactionClasses, type CustomRedaction, type PrefillLevel } from './redaction.js';

/**
 * Build a form-fillable PDF (AcroForm) of a character sheet, prefilled from
 * {@link SheetValues}. Every value is a real text field, so the PDF can be
 * edited in any reader. The prefill level redacts values by volatility — HP is
 * "frequent", AC and ability scores are "occasional" — leaving the field blank
 * but present, matching the on-screen print behaviour.
 */

export interface PdfOptions {
  prefill: PrefillLevel;
  custom: CustomRedaction;
}

const PAGE = { width: 612, height: 792 }; // US Letter, points
const MARGIN = 36;
const INK = rgb(0.1, 0.1, 0.1);
const LABEL = rgb(0.4, 0.4, 0.4);
const BORDER = rgb(0.6, 0.6, 0.6);

type Volatility = 'frequent' | 'occasional' | 'stable';

export async function buildCharacterPdf(
  values: SheetValues,
  options: PdfOptions
): Promise<Uint8Array> {
  const hide = new Set(redactionClasses(options.prefill, options.custom));
  const skip = (v: Volatility) =>
    (v === 'frequent' && hide.has('hide-frequent')) ||
    (v === 'occasional' && hide.has('hide-occasional')) ||
    hide.has('hide-all');

  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE.width, PAGE.height]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const form = doc.getForm();

  // Top-down cursor; pdf-lib's origin is bottom-left so we convert via `top`.
  const top = (y: number) => PAGE.height - y;
  let fieldSeq = 0;
  const fieldName = (base: string) => `${base}_${fieldSeq++}`;

  /** A labelled, optionally-prefilled text field box. */
  function field(
    name: string,
    label: string,
    value: string,
    x: number,
    y: number,
    w: number,
    h: number,
    volatility: Volatility = 'stable'
  ) {
    page.drawText(label.toUpperCase(), {
      x: x + 2,
      y: top(y) - 8,
      size: 6,
      font,
      color: LABEL
    });
    const tf = form.createTextField(fieldName(name));
    tf.setText(skip(volatility) ? '' : value);
    // addToPage (with a font) creates the field's default appearance; only then
    // can the font size be set.
    tf.addToPage(page, {
      x,
      y: top(y + h),
      width: w,
      height: h - 11,
      borderColor: BORDER,
      borderWidth: 1,
      backgroundColor: rgb(1, 1, 1),
      font
    });
    tf.setFontSize(11);
  }

  // --- Header ---
  page.drawText(skip('stable') ? '' : values.name, {
    x: MARGIN,
    y: top(MARGIN + 14),
    size: 22,
    font: bold,
    color: INK
  });
  page.drawText(values.classLine, { x: MARGIN, y: top(MARGIN + 30), size: 10, font, color: LABEL });
  line(page, MARGIN, top(MARGIN + 38), PAGE.width - MARGIN, top(MARGIN + 38));

  const colW = (PAGE.width - 2 * MARGIN);
  let y = MARGIN + 52;

  // --- Ability scores: 6 across, score + mod ---
  const abW = colW / 6;
  values.abilities.forEach((a, i) => {
    const x = MARGIN + i * abW;
    field(`abil_${a.key}`, a.label.slice(0, 3), a.score, x + 2, y, abW - 4, 30, 'occasional');
    field(`mod_${a.key}`, 'mod', a.mod, x + 2, y + 34, abW - 4, 26, 'occasional');
  });
  y += 70;

  // --- Combat line ---
  const combat: [string, string, string, Volatility][] = [
    ['ac', 'AC', values.combat.ac, 'occasional'],
    ['init', 'Initiative', values.combat.initiative, 'occasional'],
    ['prof', 'Prof Bonus', values.combat.prof, 'occasional'],
    ['passive', 'Passive Perc', values.combat.passive, 'occasional'],
    ['hp_max', 'Max HP', values.hp.max, 'occasional'],
    ['hp_cur', 'Current HP', values.hp.current, 'frequent'],
    ['hp_tmp', 'Temp HP', values.hp.temp, 'frequent']
  ];
  const cbW = colW / combat.length;
  combat.forEach(([key, label, value, vol], i) => {
    field(key, label, value, MARGIN + i * cbW + 1, y, cbW - 4, 34, vol);
  });
  y += 48;

  // --- Saves (left column) and skills (right two columns) ---
  const colTop = y;
  page.drawText('SAVING THROWS', { x: MARGIN, y: top(y - 2), size: 8, font: bold, color: INK });
  y += 8;
  values.saves.forEach((s, i) => {
    field(`save_${s.key}`, s.label, s.value, MARGIN, y + i * 24, 150, 22, 'occasional');
  });

  // Skills in two columns on the right.
  let sy = colTop;
  page.drawText('SKILLS', { x: MARGIN + 170, y: top(colTop - 2), size: 8, font: bold, color: INK });
  sy += 8;
  const skillColW = 170;
  values.skills.forEach((s, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    field(
      `skill_${s.key}`,
      s.label,
      s.value,
      MARGIN + 170 + col * (skillColW + 6),
      sy + row * 24,
      skillColW,
      22,
      'occasional'
    );
  });

  // --- Spellcasting (if applicable), bottom-left under saves ---
  if (values.spell) {
    const spy = colTop + 8 + values.saves.length * 24 + 12;
    field('spell_dc', 'Spell Save DC', values.spell.dc, MARGIN, spy, 72, 34, 'occasional');
    field('spell_atk', 'Spell Attack', values.spell.attack, MARGIN + 78, spy, 72, 34, 'occasional');
  }

  return doc.save();
}

function line(page: PDFPage, x1: number, y1: number, x2: number, y2: number) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 1.2, color: INK });
}
