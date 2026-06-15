import fs from 'node:fs';
import { readerFromZip } from '/home/user/characterSheet/src/lib/data/zip.ts';
import { parseCatalog } from '/home/user/characterSheet/src/lib/data/parse.ts';
import { SearchIndex } from '/home/user/characterSheet/src/lib/data/search.ts';

const t0 = Date.now();
const bytes = new Uint8Array(fs.readFileSync('/tmp/5etools.zip'));
const reader = readerFromZip(bytes);
const cat = parseCatalog(reader, '5etools-v2.30.0');
const t1 = Date.now();

console.log(`parsed in ${t1 - t0}ms`);
for (const [k, v] of Object.entries(cat.counts)) console.log(`  ${k.padEnd(16)} ${v}`);

const idx = new SearchIndex(cat);
console.log(`search index: ${idx.size} entries`);
for (const q of ['+1 longsword', 'fireba', 'plate', 'bag of hold', 'alert']) {
  const hits = idx.search(q, { limit: 3 });
  console.log(`  "${q}" -> ${hits.map(h => `${h.entry.name} [${h.entry.source}]`).join(', ')}`);
}
