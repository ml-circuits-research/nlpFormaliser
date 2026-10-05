import test from 'node:test';
import assert from 'node:assert/strict';
import {loadStrategy, formalizeToCNL} from '../tools/lib/strategies.mjs';
import {taskLLM} from '../tools/lib/pworker.mjs';
import {SYSTEM} from '../strategies/explicit-scope-logic/index.mjs';
import {fromWire} from '../strategies/compact-scope-logic/src/wire.mjs';

test('explicit grammar variant loads a matching predefined task without changing scope semantics', async () => {
  const strategy = await loadStrategy('explicit-scope-logic');
  const wire = 'N(U(x,I($.person(x),$.ready(x))))';
  const {llm} = taskLLM({file: strategy.taskFile, client: {chat: async () => ({ok:true,text:wire})}});
  const result = await formalizeToCNL(strategy, 'Not every person is ready.', {llm});
  assert.equal(result.ok,true);assert.equal(result.formalization,wire);
  assert.match(result.cnl,/not the case that \(for every/);
  assert.equal(strategy.family,'scoped-logic');
});
test('all standalone structural examples in the grammar prompt parse', () => {
  const examples = SYSTEM.split('Well-formed structural examples (not facts to add to the input):\n')[1].split('\n\n')[0].split('\n');
  assert.equal(examples.length,5);
  examples.forEach(example=>assert.doesNotThrow(()=>fromWire(example)));
});
