import test from 'node:test';
import assert from 'node:assert/strict';
import {projectCommonCNL,renderCommonCNL} from '../tools/lib/common-cnl.mjs';
import {loadSet} from '../tools/lib/evalset.mjs';
test('scoped archive gold projects with binding and explicit proposition arguments',()=>{
  for(const sample of loadSet('archive-scope-semantics')) {
    // Documented divergence: this archive gold leaves the variable-like c unbound.
    if(sample.id.endsWith('/merge_approvals')){assert.throws(()=>projectCommonCNL('compact-scope-logic',sample.reference.wire),/Unbound variable/);continue;}
    const p=projectCommonCNL('compact-scope-logic',sample.reference.wire);
    assert.equal(p.coverage.complete,true,sample.id);
    assert.equal(renderCommonCNL(JSON.parse(JSON.stringify(p))),p.cnl);
  }
});
test('common renderer distinguishes scope, roles, constants, modality and question force',()=>{
  const cnl=wire=>projectCommonCNL('compact-scope-logic',wire).cnl;
  assert.notEqual(cnl('N(U(x,$.ready(x)))'),cnl('U(x,N($.ready(x)))'));
  assert.notEqual(cnl('$.owns("a","b")'),cnl('$.owns("b","a")'));
  assert.notEqual(cnl('Q($.ready("a"))'),cnl('$.ready("a")'));
  assert.match(cnl('U(x,$.likes(x,"x"))'),/variable "X0"; "x"/);
  assert.match(cnl('$.believes("a",N($.open("door")))'),/the proposition/);
});
test('Lab facts and rules align, while glosses and templates remain residuals',()=>{
  const ir={facts:[{pred:'person',args:['ada']}],rules:[{head:{pred:'ready',args:['?x']},body:[{pred:'person',args:['?x']}]}]};
  const p=projectCommonCNL('direct-context-logic',ir);
  assert.equal(p.wholeDocumentJudgeEligible,true);
  assert.match(p.cnl,/for every variable/);
  const extra=projectCommonCNL('direct-context-logic',{...ir,contexts:[{id:'c1',gloss:'Ada thinks the door is open'}],symbols:{predicates:{person:{cnl:'ALL IS WELL'}}}});
  assert.equal(extra.wholeDocumentJudgeEligible,false);
  // Only the context is a semantic residual; symbols are lexical metadata the common view never renders.
  assert.deepEqual(extra.residuals.map(r=>r.source),['contexts']);
  assert.ok(!extra.cnl.includes('ALL IS WELL'));assert.ok(!extra.cnl.includes('door'));
});
test('a normalized Lab IR with only facts/rules is eligible: version, meta, symbols and empty sections are not residuals (M3)',async()=>{
  const {normalizeIR}=await import('../strategies/lab-shared/src/ir.mjs');
  const ir=normalizeIR({facts:[{pred:'person',args:['ada']}],symbols:{entities:{ada:{label:'Ada'}},predicates:{}},meta:{strategy:'x'}});
  assert.ok('version' in ir&&Array.isArray(ir.contexts));
  const p=projectCommonCNL('direct-context-logic',ir);
  assert.equal(p.coverage.complete,true);assert.equal(p.wholeDocumentJudgeEligible,true);
});
test('unsupported families and scoped atoms cannot silently become fully projected',()=>{
  assert.equal(projectCommonCNL('discourse-semantic-graph',{turns:[]}).wholeDocumentJudgeEligible,false);
  const p=projectCommonCNL('direct-context-logic',{facts:[{pred:'open',args:['door'],context:'b1'}],rules:[],contexts:[{id:'b1',kind:'belief',holder:'bob'}]});
  assert.equal(p.coverage.complete,false);assert.equal(p.statements.length,0);
});
