import fs from 'node:fs';
import { PDFDocument } from '/home/user/characterSheet/node_modules/pdf-lib/cjs/index.js';
const bytes = fs.readFileSync('/tmp/fillable.pdf');
const doc = await PDFDocument.load(bytes);
const form = doc.getForm();
const fields = form.getFields();
console.log('total form fields:', fields.length);
const show = (prefix) => {
  const f = fields.find(f => f.getName().startsWith(prefix));
  return f ? `${f.getName()}="${f.getText?.() ?? ''}"` : '(missing)';
};
for (const pre of ['abil_dex','mod_dex','ac','hp_cur','save_dex','skill_stealth','init'])
  console.log('  ', show(pre));
