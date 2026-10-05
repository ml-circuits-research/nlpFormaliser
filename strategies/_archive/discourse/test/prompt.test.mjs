import test from 'node:test';
import assert from 'node:assert/strict';
import {judgeSystemPrompt, judgeUserPayload, buildJudgeBatches, formalizeConversation} from '../index.mjs';

test('judge prompt explicitly checks omissions and inventions',()=>{
  const p=judgeSystemPrompt();
  assert.match(p,/omitted|omission|missing/i);
  assert.match(p,/invent/i);
  assert.match(p,/scope/i);
  assert.match(p,/reference/i);
});

test('judge payload contains source and candidate CNL',()=>{
  const c=formalizeConversation([{id:'x',text:'Ada must review the report.'}]);
  const [b]=buildJudgeBatches(c,{policy:'all'});
  const u=judgeUserPayload(b);
  assert.equal(u.items[0].source_nl,'Ada must review the report.');
  assert.equal(typeof u.items[0].candidate_cnl,'string');
});
