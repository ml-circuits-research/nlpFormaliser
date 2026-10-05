import test from 'node:test';
import assert from 'node:assert/strict';
import {taskLLM} from '../tools/lib/pworker.mjs';
import {loadTask} from '../../Ploinky-Worker/lib/pworker/task.mjs';
import {FORMALIZE_SYSTEM} from '../strategies/compact-scope-logic/src/prompts.mjs';
import micro,{SYSTEM} from '../strategies/compact-scope-logic/index.mjs';
import {fromWire,toWire} from '../strategies/compact-scope-logic/src/wire.mjs';
import {validateVerdict,makeJudge} from '../tools/lib/judge.mjs';
import {formalizeToCNL} from '../tools/lib/strategies.mjs';
import {cnl,checkLogic,labStrategy} from '../strategies/lab-shared/adapter.mjs';
import {metadataAudit,reasoningCoverage} from '../strategies/lab-shared/coverage.mjs';
import {normalizeIR} from '../strategies/lab-shared/src/ir.mjs';
import {closure} from '../strategies/lab-shared/src/reasoner.mjs';
import {auditFormalization} from '../tools/lib/audit.mjs';
import {listStrategies,loadStrategy} from '../tools/lib/strategies.mjs';

test('predefined task files load and five requests use one worker batch with independent outputs',async()=>{
  const file=new URL('../strategies/compact-scope-logic/task.mjs',import.meta.url);
  await loadTask(file.pathname);
  let requests=0;
  // The batch payload is the last prompt line, whatever data marker precedes it.
  const client={json:async o=>{requests++;const entries=JSON.parse(o.prompt.trimEnd().split('\n').at(-1));return {ok:true,json:{results:Object.fromEntries(entries.reverse().map(e=>[e.id,`$.likes("${e.input}","tea")`]))}};}};
  const {llm}=taskLLM({file,client});
  const rs=await Promise.all(['Ada','Bob','Cora','Dan','Eve'].map(x=>llm(SYSTEM,x)));
  assert.equal(requests,1);assert.match(rs[0],/Ada/);assert.match(rs[4],/Eve/);
});
test('task prompt mismatch cannot silently invoke a different LLM operation',async()=>{
  const {llm}=taskLLM({file:new URL('../strategies/compact-scope-logic/task.mjs',import.meta.url),client:{}});
  await assert.rejects(llm('repair the output','x'),/does not match/);
});
test('literal copies are not MicroIR formulas; constants cannot turn into bound variables',()=>{
  assert.throws(()=>fromWire('"Every user is active"'),/formula/);
  assert.throws(()=>fromWire('N("Every user is active")'),/formula/);
  const wire='U(x,I($.person(x),$.likes(x,"x")))';
  assert.equal(toWire(fromWire(wire)),wire);
  assert.equal(micro.toReasoning(wire).statements[0].op,'forall');
});
test('invalid and contradictory judge replies remain errors, never negative semantic labels',async()=>{
  assert.equal(validateVerdict({nl_entails_cnl:false,cnl_entails_nl:null,lost:[],added:[],changed:[],reason:'counterexample'}).equivalent,false);
  assert.throws(()=>validateVerdict({nl_entails_cnl:'true',cnl_entails_nl:true,lost:[],added:[],changed:[],reason:'x'}),/Invalid/);
  const r=await makeJudge(async()=>'{"equivalent":true,"lost":["negation"],"added":[],"changed":[],"reason":"x"}','direct')('not P','P');
  assert.equal(r.status,'judge_error');assert.equal(r.equivalent,null);
});
test('native CNL metadata is preserved in the IR, but only short slot templates and labels shape the judged CNL',()=>{
  const ir=normalizeIR({facts:[{pred:'likes',args:['ada','tea']}],symbols:{entities:{ada:{label:'everything is true'}},predicates:{likes:{cnl:'The original text is faithfully preserved'}}}});
  assert.equal(cnl(ir),'ada likes tea.');
  assert.equal(metadataAudit(ir).complete,false);
  assert.equal(labStrategy('direct').toReasoning(ir).ir.symbols.predicates.likes.cnl,ir.symbols.predicates.likes.cnl);
  const short=normalizeIR({facts:[{pred:'likes',args:['ada','tea']}],symbols:{entities:{ada:{label:'Ada'}},predicates:{likes:{cnl:'{0} really likes {1}'}}}});
  assert.equal(cnl(short),'Ada really likes tea.');
  assert.equal(cnl({...short,symbols:{...short.symbols,predicates:{likes:{cnl:'{0} likes {1} every single day'}}}}),'Ada likes tea.');
});
test('reasoning supports positive Horn entailment and explicit negative facts separately',()=>{
  const ir=normalizeIR({facts:[{pred:'person',args:['ada']},{pred:'banned',args:['ada'],neg:true}],rules:[{head:{pred:'mortal',args:['?x']},body:[{pred:'person',args:['?x']}]}]});
  assert.ok(closure(ir).some(a=>a.pred==='mortal'&&a.args[0]==='ada'));
  assert.equal(labStrategy('direct').toReasoning(ir).ir.facts[1].neg,true);
  const scoped=normalizeIR({facts:[],contexts:[{id:'belief1',kind:'belief',holder:'bob',gloss:'the door is open'}]});
  assert.equal(checkLogic(scoped).ok,true);
  assert.equal(reasoningCoverage(scoped).complete,false);
  assert.match(cnl(scoped),/CONTEXT belief1/);
});
test('surface-only controls cannot enter the reasoning ranking',()=>{
  const r={ok:true,text:'Ada likes tea.',formalization:'ASSERT: Ada likes tea.'};
  assert.equal(auditFormalization({controlOnly:true},r).eligible,false);
});
test('failure exporting reasoning is not counted as successful formalization',async()=>{
  const r=await formalizeToCNL({name:'broken',formalize:async()=>({formalization:'x'}),toCNL:()=> 'text',toReasoning:()=>{throw new Error('unsupported');}},'x');
  assert.equal(r.ok,false);assert.match(r.errors[0],/unsupported/);
});
test('public names identify mechanisms; speculative grammar is not a registered strategy',async()=>{
  assert.ok(listStrategies().includes('evidence-guided-logic'));
  assert.ok(!listStrategies().includes('microir-hybrid'));
  assert.ok(!listStrategies().includes('draft-guided-repair'));
  assert.equal((await loadStrategy('lab-proto')).name,'evidence-guided-logic');
});
