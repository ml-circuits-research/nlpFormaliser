import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createResearchPipeline} from '../strategies/compact-scope-logic/pipeline.mjs';
import {createEventPipeline} from '../strategies/event-role-logic/pipeline.mjs';
import {createNativeJudge} from '../strategies/lab-shared/judge.mjs';
import {createDiscourseReviewer} from '../strategies/discourse-semantic-graph/review.mjs';
import {formalizeConversation} from '../strategies/discourse-semantic-graph/index.mjs';
import {buildJudgeBatches, JUDGE_PROTOCOL} from '../strategies/discourse-semantic-graph/src/judge.mjs';

function scriptedTransport(responses) {
  const calls = [];
  return {
    calls,
    transport: {batchSize: 1, onCall: call => calls.push(call), client: {
      async chat() {
        assert.ok(responses.length, 'Unexpected model request');
        return {ok: true, text: responses.shift()};
      },
    }},
  };
}

test('scoped pipeline uses separate worker tasks and retains the better original candidate', async () => {
  const {transport, calls} = scriptedTransport([
    '[$.owns(ada,gpu)]', JSON.stringify({s: 0.8, eq: false}),
    '[$.owns(bob,gpu)]', JSON.stringify({s: 0.2, eq: false}),
  ]);
  const pipeline = createResearchPipeline({transport, allowRepair: true, maxRepairs: 1});
  const result = await pipeline.run('Ada owns a GPU.');
  assert.equal(result.history.length, 2);
  assert.equal(result.best.iteration, 0);
  assert.equal(result.accepted, false);
  assert.deepEqual(calls.map(c => c.taskFile.split('/').at(-1)), [
    'task.mjs', 'judge-task.mjs', 'repair-task.mjs', 'judge-task.mjs',
  ]);
});

test('repair budgets are bounded and cannot bypass first-pass mode via per-run options', () => {
  for (const maxRepairs of [-1, 0.5, Infinity, NaN]) {
    assert.throws(() => createResearchPipeline({maxRepairs}), /budget/);
  }
  assert.throws(() => createResearchPipeline({maxRepairs: 1}), /allowRepair/);
  const pipeline = createResearchPipeline({transport: scriptedTransport([]).transport});
  assert.throws(() => pipeline.run('Ada owns a GPU.', {maxRepairs: 1}), /allowRepair/);
  assert.throws(() => pipeline.run('Ada owns a GPU.', {maxRepairs: -1}), /budget/);
  assert.throws(() => createEventPipeline({rounds: 1}), /allowRepair/);
});

test('event first-pass pipeline calls only formalization and preserves executable CNL', async () => {
  const fixture = JSON.parse(readFileSync(new URL('../strategies/event-role-logic/test/fixtures.json', import.meta.url))).cases[0];
  const {transport, calls} = scriptedTransport([fixture.code]);
  const result = await createEventPipeline({transport}).run(fixture.english);
  assert.equal(result.cnl, fixture.english);
  assert.equal(result.trace.length, 1);
  assert.equal(result.rounds, 0);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].taskFile.endsWith('/event-role-logic/task.mjs'));
});

test('native Lab repeated judge retains directional measurements through predefined task', async () => {
  const reply = coverage => JSON.stringify({coverage, faithfulness: 1, scope: 1, coreference: 1, temporal_modality: 1, verdict: 'minor_loss'});
  const {transport, calls} = scriptedTransport([reply(0.5), reply(1)]);
  const judge = createNativeJudge({transport});
  const result = await judge({nl: 'Ada owns a GPU.', cnl: 'Ada owns a GPU.', runs: 2});
  assert.equal(result.coverage, 0.75);
  assert.equal(result.faithfulness, 1);
  assert.equal(result.runs.length, 2);
  assert.ok(result.coverage_stddev > 0);
  assert.ok(calls.every(c => c.taskFile.endsWith('/lab-shared/judge-task.mjs')));
  assert.throws(() => judge({nl: '', cnl: '', runs: 0}), /repetition/);
});

test('discourse review preserves native contextual batch IDs through its worker task', async () => {
  const conversation = formalizeConversation([
    {id: 't1', text: 'Every reviewer must accept a paper.'},
    {id: 't2', text: 'Not every reviewer must accept a paper.'},
  ]);
  const [batch] = buildJudgeBatches(conversation, {policy: 'all'});
  const response = {protocol: JUDGE_PROTOCOL, batch_id: batch.batch_id,
    results: batch.items.map(item => ({turn_id: item.turn_id, verdict: 'uncertain',
      confidence: 0.5, missing: [], invented: [], scope_errors: [], reference_errors: [],
      speech_act_error: null, reason: 'Transport fixture, not a semantic judgment.'}))};
  const {transport, calls} = scriptedTransport([JSON.stringify(response)]);
  const result = await createDiscourseReviewer({transport})(conversation);
  assert.deepEqual(result.responses, [response]);
  assert.equal(result.batches[0].items[1].context[0].id, 't1');
  assert.equal(result.validated.turns.length, 2);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].taskFile.endsWith('/discourse-semantic-graph/judge-task.mjs'));
});
