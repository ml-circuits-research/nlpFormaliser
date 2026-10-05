import test from 'node:test';
import assert from 'node:assert/strict';
import {toLogic} from '../strategies/compact-scope-logic/index.mjs';
import {evaluate} from '../strategies/compact-scope-logic/reasoner.mjs';
const formula=s=>toLogic(s).statements[0];
test('not every and none have different executable semantics',()=>{
  const model={domain:['e1','e2'],facts:[['flagged','you','e1'],['flagged','you','e2'],['spam','e1']],closedWorld:true};
  assert.equal(evaluate(formula('N(U(x,I($.flagged("you",x),$.spam(x))))'),model),true);
  assert.equal(evaluate(formula('U(x,I($.flagged("you",x),N($.spam(x))))'),model),false);
});
test('quantifier alternation and argument order survive reasoning export',()=>{
  const model={domain:['a','b'],facts:[['likes','a','a'],['likes','b','b']],closedWorld:true};
  assert.equal(evaluate(formula('U(x,E(y,$.likes(x,y)))'),model),true);
  assert.equal(evaluate(formula('E(y,U(x,$.likes(x,y)))'),model),false);
  const directional={domain:['a','b'],facts:[['sent','a','b']],closedWorld:true};
  assert.equal(evaluate(formula('$.sent("a","b")'),directional),true);
  assert.equal(evaluate(formula('$.sent("b","a")'),directional),false);
});
test('open-world absence is unknown and questions are not assertions',()=>{
  assert.equal(evaluate(formula('$.active("Ada")'),{domain:['Ada']}),null);
  assert.throws(()=>evaluate(formula('Q($.active("Ada"))'),{domain:['Ada']}),/Unsupported assertion/);
  assert.throws(()=>evaluate(formula('$.believes("Bob",$.open("door"))'),{domain:['Bob','door']}),/proposition-valued/);
});
