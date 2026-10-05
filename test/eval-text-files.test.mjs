import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {loadSet,listSets} from '../tools/lib/evalset.mjs';
import {ROOT} from '../tools/lib/strategies.mjs';

test('each recovered example has its own authoritative plain-text file',()=>{
  let imported=0;
  for(const set of readdirSync(join(ROOT,'docs','evaluation','atomic')).filter(s=>s.startsWith('archive-'))) {
    const rows=loadSet(set);
    imported+=rows.length;
    assert.equal(new Set(rows.map(r=>r.file)).size,rows.length);
    for(const row of rows) {
      assert.ok(row.file.endsWith('.txt'));
      assert.equal(readFileSync(row.file,'utf8').trim(),row.text);
      assert.ok(row.metadataFile.includes('/docs/evaluation/metadata/'));
    }
    assert.ok(readdirSync(join(ROOT,'docs','evaluation','atomic',set)).every(f=>f.endsWith('.txt')));
  }
  assert.equal(imported,153);
  const [dialogue]=loadSet('archive-discourse-dialogue');
  assert.equal(dialogue.turns.length,30);
  assert.equal(dialogue.text.split('\n').length,30);
});

test('consolidated corpus preserves 280 sources in 29 long mixed-speech-act texts',()=>{
  assert.deepEqual(listSets(),['consolidated']);
  const rows=loadSet('consolidated');
  assert.equal(rows.length,29);
  const sources=[];
  for(const row of rows){
    assert.equal(readFileSync(row.file,'utf8').trim(),row.text);
    assert.ok([...new Intl.Segmenter('en',{granularity:'sentence'}).segment(row.text)].length>=10);
    assert.equal(row.construction.addedSentences.length,3);
    assert.ok(row.construction.addedSentences.some(s=>s.endsWith('?')));
    assert.ok(['question','instruction','emotion'].every(tag=>row.tags.includes(tag)));
    for(const source of row.construction.sources){
      const original=readFileSync(join(ROOT,source.archivedFile),'utf8').trim();
      assert.ok(row.text.includes(original));sources.push(source.set+'/'+source.id);
    }
  }
  assert.equal(sources.length,280);assert.equal(new Set(sources).size,280);
  const selection=JSON.parse(readFileSync(join(ROOT,'docs/evaluation/selections/consolidated-first10.json'),'utf8'));
  assert.equal(selection.ids.length,10);
  assert.equal(new Set(selection.ids).size,10);
  assert.ok(selection.ids.every(id=>rows.some(r=>r.id===id&&r.provenance.partition!=='source-heldout')));
  assert.throws(()=>loadSet('success'),/not input corpora/);
  assert.throws(()=>loadSet('fail'),/not input corpora/);
});
