import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {loadSet,listSets} from '../tools/lib/evalset.mjs';
import {ROOT} from '../tools/lib/strategies.mjs';

test('each recovered example has its own authoritative plain-text file',()=>{
  let imported=0;
  for(const set of listSets().filter(s=>s.startsWith('archive-'))) {
    const rows=loadSet(set);
    imported+=rows.length;
    assert.equal(new Set(rows.map(r=>r.file)).size,rows.length);
    for(const row of rows) {
      assert.ok(row.file.endsWith('.txt'));
      assert.equal(readFileSync(row.file,'utf8').trim(),row.text);
      assert.ok(row.metadataFile.includes('/docs/evaluation/metadata/'));
    }
    assert.ok(readdirSync(join(ROOT,'eval',set)).every(f=>f.endsWith('.txt')));
  }
  assert.equal(imported,153);
  const [dialogue]=loadSet('archive-discourse-dialogue');
  assert.equal(dialogue.turns.length,30);
  assert.equal(dialogue.text.split('\n').length,30);
});
