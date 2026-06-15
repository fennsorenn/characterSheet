import { parseTaggedString, renderToText } from '/home/user/characterSheet/src/lib/render/tags.ts';
import fs from 'node:fs';
let total=0, leaked=0; const samples=[];
for (const f of ['5e/data/spells/spells-phb.json','5e/data/items.json','5e/data/feats.json']) {
  const d=JSON.parse(fs.readFileSync(f,'utf8'));
  for (const arr of Object.values(d)) {
    if (!Array.isArray(arr)) continue;
    for (const ent of arr) {
      const walk=(x)=>{ if(typeof x==='string'){ total++; const t=renderToText(parseTaggedString(x)); if(/\{@/.test(t)){leaked++; if(samples.length<5)samples.push(t.slice(0,120));} }
        else if(Array.isArray(x)) x.forEach(walk); else if(x&&typeof x==='object') Object.values(x).forEach(walk); };
      walk(ent.entries); walk(ent.entriesHigherLevel);
    }
  }
}
console.log(`strings rendered: ${total}, with leftover {@ : ${leaked}`);
samples.forEach(s=>console.log('  LEAK:',s));
