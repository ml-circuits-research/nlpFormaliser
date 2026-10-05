import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadSet,sourceForModel} from '../tools/lib/evalset.mjs';
import {loadStrategy,formalizeToCNL} from '../tools/lib/strategies.mjs';
import {HeuristicStrategy as OriginalHeuristic} from '../strategies/_archive/lab/src/strategies/heuristic.mjs';
import {renderCNL as originalCNL} from '../strategies/_archive/lab/src/cnl.mjs';
import {compileFormalModule} from '../strategies/lab-shared/src/compiler.mjs';
import {renderCNL} from '../strategies/lab-shared/src/cnl.mjs';
import * as oldMicro from '../strategies/_archive/microir/src/index.mjs';
import * as newWire from '../strategies/compact-scope-logic/src/wire.mjs';
import {toCNL} from '../strategies/compact-scope-logic/src/cnl.mjs';
import {formalizeConversation,renderTurn} from '../strategies/_archive/discourse/src/formalizer.mjs';
import {behaviorMetrics} from '../strategies/_archive/lab/src/evaluator.mjs';
import {taskLLM} from '../tools/lib/pworker.mjs';

test('all 60 native lab cases preserve deterministic IR, ProtoIR, artifacts and CNL',async()=>{
  const adapted=await loadStrategy('deterministic-rule-draft');
  for(const sample of [...loadSet('archive-lab-development'),...loadSet('archive-lab-heldout')]){
    const expected=await new OriginalHeuristic().formalize(sample.text);
    const actual=await adapted.formalize(sample.text);
    assert.deepEqual(actual.formalization,expected.ir,sample.id);
    assert.deepEqual(actual.proto,expected.proto,sample.id);
    assert.deepEqual(actual.artifacts,expected.artifacts,sample.id);
    assert.equal(adapted.toCNL(actual.formalization),originalCNL(expected.ir),sample.id);
    const probes=adapted.evaluateReference(actual.formalization,{tests:sample.reference.behavior});
    if(probes.coverage.complete)assert.deepEqual(probes.behavior,behaviorMetrics(expected.ir,sample.reference.behavior),sample.id);
  }
});
test('all 30 native scoped references preserve readable and compact CNL after safe wire fixes',()=>{
  for(const sample of loadSet('archive-scope-semantics')){
    const code=sample.reference.wire;
    for(const compact of [false,true])assert.equal(toCNL(newWire.fromWire(code),{compact}),oldMicro.toCNL(oldMicro.fromWire(code),{compact}),sample.id);
    assert.equal(toCNL(newWire.fromWire(newWire.toWire(newWire.fromWire(code)))),toCNL(newWire.fromWire(code)),sample.id);
  }
});
test('30-turn discourse retains state, uncertainties, audits and original rendering',async()=>{
  const [sample]=loadSet('archive-discourse-dialogue');
  const strategy=await loadStrategy('discourse-semantic-graph');
  const r=await strategy.formalize(sample.text,{turns:sample.turns});
  const expected=formalizeConversation(sample.turns);
  assert.deepEqual(r.formalization,expected);
  assert.equal(strategy.toCNL(r.formalization),expected.turns.map(renderTurn).join('\n\n'));
  assert.ok(r.helperRequests.length);assert.equal(r.reviewBatches.flatMap(b=>b.items).length,30);
  assert.equal(r.formalization.turns[0].source,sample.turns[0].text);
});
test('evaluation import is lossless and does not feed gold to model inputs',()=>{
  const sets=['archive-lab-development','archive-lab-heldout','archive-scope-semantics','archive-scope-corruptions','archive-speech-acts','archive-discourse-dialogue','archive-speech-sample'];
  assert.deepEqual(sets.map(s=>loadSet(s).length),[31,29,30,11,50,1,1]);
  for(const set of sets)for(const row of loadSet(set)){
    assert.ok(row.sourceRecord);assert.ok(row.provenance.archive);
    const leaked={...row,reference:{secret:'DO_NOT_SEND'},sourceRecord:{secret:'DO_NOT_SEND'}};
    assert.ok(!sourceForModel(leaked).includes('DO_NOT_SEND'));
  }
  const first=loadSet('archive-lab-development')[0];
  assert.deepEqual(first.reference.behavior,first.sourceRecord.tests);
  const pair=loadSet('archive-scope-corruptions')[0];assert.notEqual(pair.reference.goodWire,pair.reference.badWire);
});
test('full lab contexts, ambiguity, query and external declarations survive compiled module execution',async()=>{
  const ir={facts:[{pred:'owns',args:['ada','gpu']}],rules:[],contexts:[{id:'b1',kind:'belief',holder:'bob',gloss:'the door is open'}],ambiguities:[{gloss:'attachment unresolved',options:['instrument','attribute']}],queries:[{vars:['?x'],where:[{pred:'owns',args:['?x','gpu']}]}],externals:[{predicate:'sha256',roles:['input','digest'],implementation:'crypto.sha256'}],symbols:{entities:{ada:{label:'Ada'}},predicates:{owns:{cnl:'{0} owns {1}'}}}};
  const source=compileFormalModule(ir);
  const mod=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  assert.equal(mod.toCNL(),renderCNL(ir));
  assert.equal(mod.formalIR.contexts.length,1);assert.equal(mod.formalIR.ambiguities.length,1);assert.equal(mod.formalIR.externals.length,1);
});
test('direct, evidence and repair native prompts execute predefined worker tasks without narrowing the IR',async()=>{
  const native={facts:[{pred:'owns',args:['ada','gpu']}],rules:[],contexts:[{id:'b1',kind:'belief',gloss:'Bob believes the door is open'}],ambiguities:[{gloss:'reference unresolved',options:['ada','bob']}],externals:[{predicate:'sha256',roles:['input','digest']}],queries:[{vars:['?x'],where:[{pred:'owns',args:['?x','gpu']}]}],symbols:{entities:{ada:{label:'Ada'}},predicates:{owns:{cnl:'{0} owns {1}'}}}};
  for(const id of ['direct-context-logic','evidence-guided-logic','draft-guided-repair']){
    const strategy=await loadStrategy(id);let calls=0;
    const {llm}=taskLLM({file:strategy.taskFile,client:{chat:async()=>{calls++;return {ok:true,text:JSON.stringify(native)};}}});
    const r=await formalizeToCNL(strategy,'Ada owns a GPU. Bob believes the door is open.',{llm,options:{allowRepair:true}});
    assert.equal(r.ok,true,r.errors.join('; '));assert.equal(calls,1);
    assert.equal(r.formalization.contexts.length,1);assert.equal(r.formalization.ambiguities.length,1);assert.equal(r.formalization.externals.length,1);
    assert.equal(r.reasoning.coverage.complete,false);assert.ok(r.extra.proto.tokens.length);assert.ok(r.extra.artifacts.rawModelOutput);
  }
});
