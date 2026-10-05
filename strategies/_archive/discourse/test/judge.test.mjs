import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formalizeConversation,
  buildJudgeBatches,
  judgeBatch,
  validateJudgeResponse,
  combineValidation,
  JUDGE_PROTOCOL,
} from '../index.mjs';

const conv = formalizeConversation([
  {id:'t1',text:'Every reviewer must accept a paper.'},
  {id:'t2',text:'Not every reviewer must accept a paper.'}
]);

test('buildJudgeBatches can judge all candidates in one batch', () => {
  const batches = buildJudgeBatches(conv, {policy:'all', maxItems:100});
  assert.equal(batches.length, 1);
  assert.equal(batches[0].items.length, 2);
});

test('judgeBatch accepts provider-independent callback', async () => {
  const [batch] = buildJudgeBatches(conv, {policy:'all'});
  const response = await judgeBatch(batch, {
    callLLM: async () => ({
      protocol:JUDGE_PROTOCOL,
      batch_id:batch.batch_id,
      results:batch.items.map(x=>({
        turn_id:x.turn_id,
        verdict:'equivalent',
        confidence:0.93,
        missing:[], invented:[], scope_errors:[], reference_errors:[],
        speech_act_error:null,
        reason:'mock semantic equivalence'
      }))
    })
  });
  assert.equal(response.results.length, 2);
});

test('validateJudgeResponse rejects incomplete response', () => {
  const [batch] = buildJudgeBatches(conv, {policy:'all'});
  const bad = {protocol:JUDGE_PROTOCOL,batch_id:batch.batch_id,results:[]};
  const checked = validateJudgeResponse(batch,bad);
  assert.equal(checked.ok,false);
  assert.ok(checked.errors.some(x=>x.includes('missing result')));
});

test('combineValidation stores judge result', () => {
  const [batch] = buildJudgeBatches(conv,{policy:'all'});
  const response={
    protocol:JUDGE_PROTOCOL,batch_id:batch.batch_id,
    results:batch.items.map(x=>({turn_id:x.turn_id,verdict:'equivalent',confidence:0.95,missing:[],invented:[],scope_errors:[],reference_errors:[],speech_act_error:null,reason:'ok'}))
  };
  const final=combineValidation(conv,[response]);
  assert.equal(final.turns.length,2);
  assert.ok(final.turns.every(x=>x.validation.judge));
});
