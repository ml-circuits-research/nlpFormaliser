import test from 'node:test';
import assert from 'node:assert/strict';
import {compareStrategies, wilson} from '../tools/lib/complementarity.mjs';
const row = (strategy,id,equivalent,status='judged') => ({strategy,id,sourceText:id,category:'scope',verdict:{status,equivalent}});
test('complementary errors, shared errors and unknown labels remain distinct', () => {
  const r=compareStrategies([
    row('a','1',true),row('b','1',false),row('a','2',false),row('b','2',true),
    row('a','3',false),row('b','3',false),row('a','4',true),row('b','4',null,'judge_error'),
  ]);
  const p=r.pairs[0];
  assert.equal(p.shared,4);assert.equal(p.labeled,3);assert.equal(p.unknown,1);
  assert.equal(p.leftOnly,1);assert.equal(p.rightOnly,1);assert.equal(p.bothWrong,1);
  assert.equal(p.oracleGainOverBestSingle,1/3);
  assert.equal(r.competence.b.scope.unknown,1);
});
test('perfect tiny samples do not establish certainty and missing labels are unmeasured', () => {
  assert.ok(wilson(5,5)[0]<0.6);assert.equal(wilson(0,0),null);
  assert.equal(compareStrategies([row('a','1',null)]).competence.a.scope.accuracy,null);
});
test('cannot silently pool duplicate or mismatched case identities', () => {
  assert.throws(()=>compareStrategies([row('a','1',true),row('a','1',false)]),/Duplicate/);
  assert.throws(()=>compareStrategies([row('a','1',true),{...row('b','1',true),context:'other'}]),/Different source/);
});
test('identical judge inputs with opposite labels are exposed, not independent votes',()=>{
  const rows=[{...row('direct-context-logic','1',true),ok:true,cnl:'Ada owns a GPU.'},
    {...row('evidence-guided-logic','1',false),ok:true,cnl:'Ada owns a GPU.'}];
  const report=compareStrategies(rows);
  assert.equal(report.identicalJudgeInputs.length,1);
  assert.equal(report.identicalJudgeInputs[0].contradictoryLabels,true);
  assert.equal(report.families['direct-context-logic'],report.families['evidence-guided-logic']);
});
