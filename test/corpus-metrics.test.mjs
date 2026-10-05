import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {ROOT} from '../tools/lib/strategies.mjs';
import {summarizeRows,breakdown} from '../tools/lib/metrics.mjs';

test('preserved archive modules match their import manifest', () => {
  const manifest=JSON.parse(readFileSync(join(ROOT,'docs/archive-import-manifest.json'),'utf8'));
  for(const entry of manifest.files) {
    const bytes=readFileSync(join(ROOT,entry.destination));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.installedSha256,entry.destination);
    if(!entry.changes.length)assert.equal(entry.installedSha256,entry.sourceSha256,entry.destination);
  }
});

test('empty probes are unmeasured and category metrics preserve specialization', () => {
  assert.equal(summarizeRows([]).behavioral.accuracy,null);
  const rows=[
    {category:'scope',tags:['negation','quantifier'],ok:true,audit:{eligible:true},verdict:{status:'judged',equivalent:true},referenceEvaluation:{behavior:{rows:[{kind:'semantic',pass:true},{kind:'control',pass:false}]}}},
    {category:'discourse',tags:['coreference'],ok:true,audit:{eligible:false},verdict:{status:'judged',equivalent:false},referenceEvaluation:{behavior:{status:'unsupported'}}},
  ];
  assert.equal(breakdown(rows,'category').scope.equivalent,1);
  assert.equal(breakdown(rows,'category').discourse.equivalent,0);
  assert.equal(breakdown(rows,'tags').quantifier.n,1);
  assert.deepEqual(summarizeRows(rows).behavioral.controls,{tested:1,passed:0});
  assert.equal(summarizeRows(rows).behavioral.unsupportedCases,1);
});
