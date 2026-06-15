import fs from 'node:fs';
import { readerFromZip } from '/home/user/characterSheet/src/lib/data/zip.ts';
import { parseCatalog } from '/home/user/characterSheet/src/lib/data/parse.ts';
import { facetsFor, facetOptions } from '/home/user/characterSheet/src/lib/data/facets.ts';
const bytes = new Uint8Array(fs.readFileSync('/tmp/5etools.zip'));
const cat = parseCatalog(readerFromZip(bytes), 'v2.30.0');
const spells = cat.entries.spell;
const withClasses = spells.filter(s => (s._classes||[]).length).length;
console.log('spells:', spells.length, '| with class data:', withClasses);
const fb = spells.find(s => s.name==='Fireball' && s.source==='PHB');
console.log('Fireball classes:', fb._classes, '| subclasses (first 5):', fb._subclasses.slice(0,5));
// facet option counts for class
const opts = facetOptions(spells, '', facetsFor('spell'), {});
console.log('Class facet options:', opts.class.map(o=>`${o.label}(${o.count})`).join(', '));
console.log('Subclass facet option count:', opts.subclass.length);
