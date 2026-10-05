import test from 'node:test';
import assert from 'node:assert/strict';
import {extractJson} from '../tools/lib/llm.mjs';
import {validateVerdict,isTrivialNote} from '../tools/lib/judge.mjs';

const base={nl_entails_cnl:true,cnl_entails_nl:true,lost:[],added:[],changed:[],reason:'same'};

test('JSON extraction finds the first complete object, respecting strings',()=>{
  assert.deepEqual(extractJson('Verdict: {"a":1,"reason":"a } brace"} and a later {note}'),{a:1,reason:'a } brace'});
  assert.deepEqual(extractJson('{"first":true} {"second":true}'),{first:true});
  assert.deepEqual(extractJson('noise {not json} then {"ok":"\\"quoted\\" {x}"}'),{ok:'"quoted" {x}'});
  assert.deepEqual(extractJson('```json\n{"x":[{"y":2}]}\n```'),{x:[{y:2}]});
  assert.throws(()=>extractJson('no object here'),/No JSON object/);
  assert.throws(()=>extractJson('{"unterminated":'),/No JSON object/);
});

test('trivially-empty notes do not contradict a positive verdict',()=>{
  for(const note of ['none','None.','N/A','wording only','only wording','no differences','minor wording changes','-'])assert.ok(isTrivialNote(note),note);
  assert.ok(!isTrivialNote('negation dropped'));
  const v=validateVerdict({...base,lost:['none'],changed:['wording only']});
  assert.equal(v.outcome,'equivalent');assert.equal(v.equivalent,true);
  assert.deepEqual(v.lost,[]);assert.equal(v.trivialNotes.length,2);
});

test('positive verdict with substantive notes is recorded separately, not as success or error',()=>{
  const v=validateVerdict({...base,changed:['tense shifted from past to present']});
  assert.equal(v.status,'judged');assert.equal(v.outcome,'equivalent_with_notes');assert.equal(v.equivalent,null);
});

test('three-valued conjunction and consistent rejection of string booleans',()=>{
  assert.equal(validateVerdict({...base,cnl_entails_nl:null}).outcome,'uncertain');
  assert.equal(validateVerdict({...base,nl_entails_cnl:false,cnl_entails_nl:null}).equivalent,false);
  assert.throws(()=>validateVerdict({...base,nl_entails_cnl:'true'}),/Invalid judge field/);
  assert.throws(()=>validateVerdict({equivalent:'false',lost:[],added:[],changed:[],reason:'x'},'direct'),/Invalid judge field/);
});
