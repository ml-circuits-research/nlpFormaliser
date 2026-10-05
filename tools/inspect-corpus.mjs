#!/usr/bin/env node
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {listSets, loadSet} from './lib/evalset.mjs';
import {ROOT} from './lib/strategies.mjs';
import {digest} from './lib/pworker.mjs';

const sets = {};
const texts = new Map();
for (const name of listSets()) {
  const cases = loadSet(name);
  sets[name] = {
    records: cases.length,
    kinds: {},
    categories: {},
    tags: {},
    behavioralProbes: 0,
    contextualRecords: 0,
    referenceRepresentations: 0,
  };
  for (const item of cases) {
    const stats = sets[name];
    const kind = item.kind ?? 'formalization';
    stats.kinds[kind] = (stats.kinds[kind] ?? 0) + 1;
    stats.categories[item.category] = (stats.categories[item.category] ?? 0) + 1;
    for (const tag of item.tags ?? []) stats.tags[tag] = (stats.tags[tag] ?? 0) + 1;
    stats.behavioralProbes += item.reference?.behavior?.length ?? 0;
    if (item.context !== undefined || item.turns) stats.contextualRecords++;
    if (item.reference && Object.keys(item.reference).length) stats.referenceRepresentations++;
    const hash = digest(item.text.toLowerCase().replace(/\s+/g, ' ').trim());
    if (!texts.has(hash)) texts.set(hash, []);
    texts.get(hash).push({set: name, id: item.id, kind, partition: item.provenance?.partition ?? 'base'});
  }
}
const overlaps = [...texts.entries()].filter(([, records]) => records.length > 1)
  .map(([normalizedTextHash, records]) => ({normalizedTextHash, records}));
const report = {
  note: 'Duplicate texts are reported, not merged. Judge pairs may intentionally reuse formalizer texts. Overlap is not statistical independence.',
  sets,
  overlaps,
};
writeFileSync(join(ROOT, 'docs', 'evaluation', 'coverage-inventory.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({sets: Object.keys(sets).length, records: Object.values(sets).reduce((sum, s) => sum + s.records, 0), overlapGroups: overlaps.length}, null, 2));
